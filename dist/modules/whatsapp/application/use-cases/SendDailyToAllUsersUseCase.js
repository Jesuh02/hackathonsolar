"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SendDailyToAllUsersUseCase", {
    enumerable: true,
    get: function() {
        return SendDailyToAllUsersUseCase;
    }
});
const _Result = require("../../../../shared/domain/Result");
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
let SendDailyToAllUsersUseCase = class SendDailyToAllUsersUseCase {
    async execute() {
        try {
            const supabase = (0, _SupabaseClient.getSupabaseClient)();
            const { data: profiles, error } = await supabase.from('business_profiles').select('*').eq('daily_recommendations_enabled', true);
            if (error) {
                return _Result.Result.fail(`Error al obtener perfiles de Supabase: ${error.message}`);
            }
            if (!profiles || profiles.length === 0) {
                console.log('[DailyToAll] No hay usuarios con recomendaciones diarias activas.');
                return _Result.Result.ok(undefined);
            }
            const results = await Promise.allSettled(profiles.map((p)=>this.sendToUser(p)));
            const failures = results.filter((r)=>r.status === 'rejected');
            if (failures.length > 0) {
                console.error(`[DailyToAll] ${failures.length} envíos fallaron:`, failures);
            }
            console.log(`[DailyToAll] Procesados ${profiles.length} usuarios, ${failures.length} errores.`);
            return _Result.Result.ok(undefined);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return _Result.Result.fail(msg);
        }
    }
    async sendToUser(profile) {
        const today = new Date();
        const fmt = (d)=>`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const windowStart = new Date(today);
        windowStart.setDate(windowStart.getDate() - 30);
        // Fetch today's irradiance in parallel with recommendations
        const lat = profile.latitude ?? 11.5444;
        const lng = profile.longitude ?? -72.9072;
        const [recResult, { todayKwh, avg30Kwh }] = await Promise.all([
            this.generateRecommendations.execute({
                businessName: profile.business_name,
                businessType: profile.business_type,
                monthlyConsumptionKwh: profile.monthly_consumption_kwh,
                peakDemandKw: profile.peak_demand_kw,
                operatingHoursPerDay: profile.operating_hours_per_day,
                hasSolarPanels: profile.has_solar_panels,
                hasBatteryStorage: profile.has_battery_storage,
                electricityRateCopPerKwh: profile.electricity_rate_cop_per_kwh,
                location: {
                    lat,
                    lng: lng,
                    address: profile.address
                },
                startDate: fmt(windowStart),
                endDate: fmt(today)
            }),
            this.fetchTodayIrradiance(lat, lng)
        ]);
        if (recResult.isFailure) {
            throw new Error(`Recommendations failed for ${profile.phone}: ${recResult.error}`);
        }
        const rec = recResult.value;
        const dayLabel = today.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'America/Bogota'
        });
        const topRecs = rec.recommendations.slice(0, 3);
        const lines = [
            `☀️ *Recomendaciones diarias de ahorro energético*`,
            `📅 ${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}`,
            `🏪 *${profile.business_name}*`,
            `📍 ${profile.address}`,
            ``
        ];
        // Include today's irradiance from NASA POWER API
        if (todayKwh !== null) {
            const trend = avg30Kwh !== null ? todayKwh >= avg30Kwh ? `▲ sobre el promedio (${avg30Kwh} kWh/m²/día)` : `▼ bajo el promedio (${avg30Kwh} kWh/m²/día)` : '';
            lines.push(`🌞 *Radiación solar hoy (NASA POWER):* ${todayKwh.toFixed(2)} kWh/m²/día ${trend}`);
            lines.push(``);
        }
        lines.push(`📊 *Puntuación energética:* ${rec.energyScore}/100`, `💡 *Ahorro estimado:* ${rec.estimatedMonthlySavingsKwh.toFixed(0)} kWh/mes (~${this.formatCop(rec.estimatedMonthlySavingsCop)})`, ``, `*Recomendaciones de hoy:*`);
        topRecs.forEach((r, i)=>{
            const icon = r.priority === 'critica' ? '🔴' : r.priority === 'alta' ? '🟠' : '🟡';
            lines.push(``, `${icon} *${i + 1}. ${r.title}*`, r.description, `➡️ ${r.action}`);
        });
        lines.push(``, `_Agente Solar · Riohacha, La Guajira_`);
        lines.push(`_Responde cualquier pregunta sobre energía solar 👋_`);
        const sendResult = await this.whatsApp.sendMessage({
            to: profile.phone,
            body: lines.join('\n')
        });
        if (sendResult.isFailure) {
            throw new Error(sendResult.error);
        }
    }
    /** Fetches today's irradiance and a 30-day average for the given coordinates. */ async fetchTodayIrradiance(lat, lng) {
        const fmt = (d)=>`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const today = new Date();
        const window30Start = new Date(today);
        window30Start.setDate(window30Start.getDate() - 30);
        try {
            const result = await this.nasaApi.fetchDailyRadiation({
                start: fmt(window30Start),
                end: fmt(today),
                latitude: lat,
                longitude: lng,
                community: 'RE',
                parameters: [
                    'ALLSKY_SFC_SW_DWN'
                ]
            });
            if (result.isFailure || result.value.length === 0) {
                return {
                    todayKwh: null,
                    avg30Kwh: null
                };
            }
            const data = result.value;
            const todayStr = fmt(today);
            const todayRecord = data.find((d)=>d.date === todayStr);
            const avg30 = data.reduce((s, d)=>s + d.irradiance, 0) / data.length;
            return {
                todayKwh: todayRecord?.irradiance ?? data[data.length - 1]?.irradiance ?? null,
                avg30Kwh: parseFloat(avg30.toFixed(2))
            };
        } catch  {
            return {
                todayKwh: null,
                avg30Kwh: null
            };
        }
    }
    formatCop(amount) {
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M COP`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k COP`;
        return `$${amount.toFixed(0)} COP`;
    }
    constructor(whatsApp, generateRecommendations, nasaApi){
        _define_property(this, "whatsApp", void 0);
        _define_property(this, "generateRecommendations", void 0);
        _define_property(this, "nasaApi", void 0);
        this.whatsApp = whatsApp;
        this.generateRecommendations = generateRecommendations;
        this.nasaApi = nasaApi;
    }
};

//# sourceMappingURL=SendDailyToAllUsersUseCase.js.map