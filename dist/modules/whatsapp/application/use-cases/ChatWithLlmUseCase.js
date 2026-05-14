"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatWithLlmUseCase", {
    enumerable: true,
    get: function() {
        return ChatWithLlmUseCase;
    }
});
const _Result = require("../../../../shared/domain/Result");
const _HttpClient = require("../../../../shared/infrastructure/HttpClient");
const _SupabaseClient = require("../../../../shared/infrastructure/SupabaseClient");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/** Maximum number of previous turns to include in each LLM request */ const MAX_HISTORY = 12;
const historicalCacheMap = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let ChatWithLlmUseCase = class ChatWithLlmUseCase {
    async execute(phone, userMessage) {
        try {
            const supabase = (0, _SupabaseClient.getSupabaseClient)();
            // 1. Load business profile (null-safe: works even without a profile)
            const { data: profile } = await supabase.from('business_profiles').select('*').eq('phone', phone).maybeSingle();
            // 2. Load recent conversation history BEFORE saving the new message
            const { data: historyRows } = await supabase.from('conversations').select('role, content').eq('phone', phone).order('created_at', {
                ascending: false
            }).limit(MAX_HISTORY);
            const history = (historyRows ?? []).reverse().map((r)=>({
                    role: r.role,
                    content: r.content
                }));
            // 3. Persist user message
            await supabase.from('conversations').insert({
                phone,
                role: 'user',
                content: userMessage
            });
            // 4. Fetch current solar data for this user's location
            const solarContext = await this.buildSolarContext(profile);
            // 5. Build OpenRouter messages array
            const messages = [
                {
                    role: 'system',
                    content: this.buildSystemPrompt(profile, solarContext)
                },
                ...history,
                {
                    role: 'user',
                    content: userMessage
                }
            ];
            // 6. Call LLM
            const response = await this.http.post('/chat/completions', {
                model: this.model,
                messages,
                temperature: 0.7,
                max_tokens: 1500
            });
            // Strip <think>…</think> blocks emitted by Qwen3 / DeepSeek thinking models
            const rawContent = response.choices[0]?.message?.content ?? '';
            const reply = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || 'Lo siento, no pude procesar tu consulta. Por favor intenta de nuevo. 🙏';
            console.log(`[ChatWithLlmUseCase] Reply to ${phone}: ${reply.slice(0, 300)}${reply.length > 300 ? '…' : ''}`);
            // 7. Persist assistant reply
            await supabase.from('conversations').insert({
                phone,
                role: 'assistant',
                content: reply
            });
            return _Result.Result.ok(reply);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[ChatWithLlmUseCase] Error:', msg);
            return _Result.Result.fail(msg);
        }
    }
    // ─────────────────────────── helpers ──────────────────────────────────────
    async buildSolarContext(profile) {
        const lat = profile?.latitude ?? 11.5444;
        const lng = profile?.longitude ?? -72.9072;
        const cacheKey = `${lat},${lng}`;
        // Return cached summary if fresh (TTL 24h)
        const cached = historicalCacheMap.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            return cached.summary;
        }
        const fmt = (d)=>`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const today = new Date();
        try {
            // Single call: 2019-01-01 → today gives full historical + recent data
            const result = await this.nasaApi.fetchDailyRadiation({
                start: '20190101',
                end: fmt(today),
                latitude: lat,
                longitude: lng,
                community: 'RE',
                parameters: [
                    'ALLSKY_SFC_SW_DWN'
                ]
            });
            if (result.isFailure || result.value.length === 0) {
                return 'Datos de radiación solar no disponibles temporalmente.';
            }
            const data = result.value;
            // ── Monthly averages per year ─────────────────────────────────────
            const byYearMonth = new Map();
            for (const d of data){
                const key = `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}`;
                if (!byYearMonth.has(key)) byYearMonth.set(key, []);
                byYearMonth.get(key).push(d.irradiance);
            }
            const monthlyLines = Array.from(byYearMonth.entries()).sort(([a], [b])=>a.localeCompare(b)).map(([key, vals])=>{
                const avg = vals.reduce((s, v)=>s + v, 0) / vals.length;
                return `  ${key}: ${avg.toFixed(2)} kWh/m²/día`;
            });
            // ── Last 30 days summary ──────────────────────────────────────────
            const recent30 = data.slice(-30);
            const avgRecent = recent30.reduce((s, d)=>s + d.irradiance, 0) / recent30.length;
            const maxRecent = Math.max(...recent30.map((d)=>d.irradiance));
            const minRecent = Math.min(...recent30.map((d)=>d.irradiance));
            const last7Lines = data.slice(-7).map((d)=>{
                const ds = `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`;
                return `  ${ds}: ${d.irradiance.toFixed(2)} kWh/m²/día`;
            });
            const summary = [
                `Datos históricos NASA POWER (2019–${today.getFullYear()}) lat=${lat}, lng=${lng}:`,
                `Promedios mensuales por año-mes:`,
                ...monthlyLines,
                ``,
                `Últimos 30 días:`,
                `  Promedio: ${avgRecent.toFixed(2)} kWh/m²/día`,
                `  Máximo:   ${maxRecent.toFixed(2)} kWh/m²/día`,
                `  Mínimo:   ${minRecent.toFixed(2)} kWh/m²/día`,
                `Últimos 7 días:`,
                ...last7Lines
            ].join('\n');
            historicalCacheMap.set(cacheKey, {
                summary,
                fetchedAt: Date.now()
            });
            return summary;
        } catch  {
            return 'No se pudieron obtener datos de radiación solar en este momento.';
        }
    }
    buildSystemPrompt(profile, solarContext) {
        const bizLines = profile ? [
            `Empresa: ${profile.business_name}`,
            `Tipo de negocio: ${profile.business_type}`,
            `Dirección: ${profile.address}`,
            `Consumo mensual: ${profile.monthly_consumption_kwh} kWh`,
            `Demanda pico: ${profile.peak_demand_kw} kW`,
            `Horas operación/día: ${profile.operating_hours_per_day} h`,
            `Tarifa eléctrica: ${profile.electricity_rate_cop_per_kwh} COP/kWh`,
            `Costo mensual estimado: ${(profile.monthly_consumption_kwh * profile.electricity_rate_cop_per_kwh / 1000000).toFixed(2)} M COP`,
            `Paneles solares instalados: ${profile.has_solar_panels ? 'Sí' : 'No'}`,
            `Baterías instaladas: ${profile.has_battery_storage ? 'Sí' : 'No'}`
        ] : [
            'Perfil de empresa no registrado en el sistema.'
        ];
        return `Eres el Agente Solar de Riohacha ☀️, asistente experto en energía solar y eficiencia energética para empresas en La Guajira, Colombia. Respondes en español, de forma clara, amigable y concisa (máximo 300 palabras por respuesta, adaptado para WhatsApp).

PERFIL DE LA EMPRESA:
${bizLines.join('\n')}

DATOS ACTUALES DE RADIACIÓN SOLAR (NASA POWER API):
${solarContext}

TUS CAPACIDADES:
- Calcular potencial solar, ROI, tiempo de retorno de inversión fotovoltaica
- Dimensionar sistemas solares (kWp) y baterías (kWh) según el perfil de la empresa
- Explicar el impacto de la radiación solar en la generación de energía
- Estimar ahorro mensual en COP al instalar paneles solares
- Dar recomendaciones de eficiencia energética personalizadas
- Responder preguntas generales sobre energía eléctrica en Colombia

GUÍAS IMPORTANTES:
- Usa siempre los datos reales de NASA POWER para los cálculos
- Sé específico con los números: kWh, kWp, COP, años de retorno
- Para estimar generación solar: usa η=0.80 (eficiencia del sistema) y los kWh/m²/día del NASA POWER
- Si preguntan algo fuera del tema energético, redirige amablemente con un emoji ☀️`;
    }
    constructor(nasaApi, apiKey, model, baseUrl){
        _define_property(this, "nasaApi", void 0);
        _define_property(this, "http", void 0);
        _define_property(this, "model", void 0);
        this.nasaApi = nasaApi;
        this.http = new _HttpClient.HttpClient(baseUrl);
        this.http.setAuthHeader(apiKey);
        this.model = model;
    }
};

//# sourceMappingURL=ChatWithLlmUseCase.js.map