"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OpenRouterLlmAdapter", {
    enumerable: true,
    get: function() {
        return OpenRouterLlmAdapter;
    }
});
const _Recommendation = require("../../domain/entities/Recommendation");
const _Result = require("../../../../shared/domain/Result");
const _HttpClient = require("../../../../shared/infrastructure/HttpClient");
const _zod = require("zod");
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
const capexSchema = _zod.z.object({
    minCop: _zod.z.number().nonnegative(),
    maxCop: _zod.z.number().nonnegative(),
    paybackMonths: _zod.z.number().nonnegative(),
    irr: _zod.z.number().optional(),
    npv: _zod.z.number().optional(),
    lcoe: _zod.z.number().optional()
});
const scenariosSchema = _zod.z.object({
    conservador: _zod.z.string(),
    realista: _zod.z.string(),
    optimista: _zod.z.string()
});
const recommendationItemSchema = _zod.z.object({
    priority: _zod.z.enum([
        'critica',
        'alta',
        'media',
        'baja'
    ]),
    category: _zod.z.enum([
        'operacional',
        'solar',
        'baterias',
        'demanda',
        'eficiencia'
    ]),
    impactType: _zod.z.enum([
        'economico',
        'energetico',
        'operativo'
    ]),
    confidenceLevel: _zod.z.enum([
        'alta',
        'media',
        'baja'
    ]),
    title: _zod.z.string().min(3),
    description: _zod.z.string().min(10),
    assumptions: _zod.z.array(_zod.z.string()).optional(),
    action: _zod.z.string().min(5),
    estimatedImpact: _zod.z.string().min(3),
    savingsCopPerMonth: _zod.z.number().nonnegative(),
    savingsCalculationExplanation: _zod.z.string().optional(),
    capex: capexSchema.optional(),
    scenarios: scenariosSchema.optional(),
    benchmark: _zod.z.string().optional(),
    strategicOrder: _zod.z.number().int().min(1).optional(),
    warnings: _zod.z.array(_zod.z.string()).optional()
});
const llmResponseSchema = _zod.z.object({
    energyScore: _zod.z.number().min(0).max(100),
    estimatedSavingsKwh: _zod.z.number().nonnegative(),
    recommendations: _zod.z.array(recommendationItemSchema).min(1),
    warnings: _zod.z.array(_zod.z.string()).optional()
});
let OpenRouterLlmAdapter = class OpenRouterLlmAdapter {
    async generateEnergyRecommendations(request) {
        try {
            const messages = this.buildPrompt(request);
            const response = await this.httpClient.post('/chat/completions', {
                model: this.model,
                messages,
                temperature: 0.65,
                max_tokens: 4000
            });
            const content = response.choices[0]?.message?.content;
            if (!content) {
                return _Result.Result.ok(this.buildFallbackRecommendation(request));
            }
            return this.parseResponse(content, request);
        } catch (error) {
            console.error('[OpenRouterLlmAdapter] LLM call failed:', error);
            return _Result.Result.ok(this.buildFallbackRecommendation(request));
        }
    }
    buildPrompt(request) {
        const { preComputedFinancials: fin, energyProfile: profile } = request;
        // Format last 30 days of irradiance as a compact table (most recent 15 days shown)
        const recentData = request.rawDailyData.slice(-15);
        const dataTable = recentData.map((d)=>{
            const dateStr = `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`;
            const bar = '█'.repeat(Math.round(d.irradiance));
            return `  ${dateStr}: ${d.irradiance.toFixed(2)} kWh/m² ${bar}`;
        }).join('\n');
        const systemPrompt = `Eres el Agente Solar, consultor senior certificado en eficiencia energética y energía solar fotovoltaica para PYMES en Riohacha, La Guajira, Colombia. Emites recomendaciones de nivel consultoría con cálculos financieros trazables, supuestos explícitos, CAPEX completo y ROI.

━━━ FUENTE DE DATOS ━━━
Fuente solar: NASA POWER API (ALLSKY_SFC_SW_DWN)
Período histórico: 2019-01-01 → hoy
Variable: irradiancia global horizontal diaria (kWh/m²/día)
Nivel de confianza: alta (serie histórica real, no modelada)

━━━ CONTEXTO REGIONAL ━━━
- Riohacha, La Guajira: mayor potencial solar de Colombia
- Tarifa Caribe regulada: 600–950 COP/kWh
- Cargo de potencia máxima Electrocaribeño: ~16.000 COP/kW/mes
- Fórmula producción (Caribe colombiano): E (kWh/día) = kW_pico × HSP_P50 × PR × 0,85
  · PR = 0,75 (pérdidas DC: temperatura celdas, cableado, mismatch, suciedad básica)
  · 0,85 = factor pérdidas adicionales Caribe: alta temperatura inversor (−5%), ensuciamiento acelerado (−3%), sombras parciales (−4%), degradación inicial (−3%)
  · Eficiencia real total ≈ 0,64 → conservador y auditable para proyectos en La Guajira
- Fórmula ahorro: Ahorro/mes = E × 30 × factor_autoconsumo × tarifa
- Factor de autoconsumo (fracción generada consumida en sitio, no exportada):
    hotel: 0,85 (carga continua 24h)
    hielera: 0,80 (refrigeración constante)
    retail: 0,75 (negocio diurno)
    oficina: 0,70 (horario laboral)
    industrial: 0,65 (turnos variables)
- Benchmark generación solar Caribe colombiano: 1.400–1.800 kWh/kWp/año (NO usar valores >2.000)
- Fracción de consumo en iluminación por sector: hotel 15–25%, retail 10–20%, oficina 20–35%, industrial 5–15%
  (NUNCA uses 30–40% para iluminación hotelera — sobrestima el ahorro)
- CAPEX sistema On-Grid Colombia: 3,5–5,5 M COP/kWp (paneles, inversores, estructura, mano de obra, conexión)
- CAPEX baterías Colombia 2026: 2,0–3,0 M COP/kWh instalado (LiFePO4, incluye BMS e instalación)
  Ejemplo: 20 kWh → 40–60 M COP | 10 kWh → 20–30 M COP
  ⚠️ NUNCA uses valores como "350–500 COP/kWh" (eso sería USD/kWh, no COP/kWh)
- Mantenimiento anual: 1–2% del CAPEX
- Degradación de paneles: 0,5% anual → payback ajustado = CAPEX / (ahorro_año1 × 0,988) × 12
  (0,988 ≈ factor corrección por degradación promedio primeros 10 años)
- La energía representa 28–40% del OpEx de PYMES en La Guajira

━━━ REGLAS DE CÁLCULO (OBLIGATORIAS) ━━━
1. IRRADIANCIA: usa SIEMPRE la "irradiancia P50 NASA POWER (mediana histórica)" del contexto. Nunca uses el dato del día actual para proyecciones financieras — ese valor es contextual solamente.
2. SOLAR: E = kW_pico × P50 × PR(0,75) × 0,85 (factor pérdidas Caribe). Ahorro/mes = E × 30 × autoconsumo × tarifa. ⚠️ CRÍTICO On-Grid: NO produce de noche. NUNCA uses "autoconsumo nocturno". Autoconsumo solar = EXCLUSIVAMENTE DIURNO (pico 10h–15h). Acción siempre: "maximizando autoconsumo diurno y reduciendo exportación a red".
3. DEMANDA: ahorro = kW_reducidos × 16.000 COP/mes. Factor de simultaneidad SIEMPRE como rango (ej. "0,60–0,75 estimado según operación típica"). OBLIGATORIO añadir en assumptions: "Requiere validación con medición de curva de carga (intervalos de 15 min, mínimo 2 semanas)".
4. BATERÍAS: valor principal = CONTINUIDAD OPERATIVA (CREG 030/2018), NO arbitraje tarifario. CRÍTICO: savingsCopPerMonth = costo_evitado_estimado por apagones (NO ahorro energético). description DEBE incluir: "Ahorro energético directo: 0 COP/mes. Beneficio real: continuidad operativa y prevención de pérdidas por cortes de Electrocaribeño". impactType: SIEMPRE "operativo". CAPEX: 2,0–3,0 M COP/kWh instalado.
5. SUMA CONSISTENTE: estimatedSavingsKwh = round(sum(savingsCopPerMonth de todas las recomendaciones) / tarifa). NUNCA pongas un valor top-level diferente a la suma exacta.
6. CAPEX solar completo: minCop/maxCop incluyen instalación + inversores + estructura + conexión + primer año de mantenimiento. paybackMonths = CAPEX_promedio / (ahorro_año1 × 0,988) × 12 (incluye corrección por degradación 0,5%/año).
7. ESCENARIOS: conservador usa PR=0,72 + irradiancia mínima histórica; optimista usa PR=0,78 + irradiancia máxima histórica. Siempre menciona "±15% variabilidad real".
8. BENCHMARK solar: usa kWh/kWp/año (1.400–1.800 en Caribe colombiano). NO uses valores >2.000 sin justificar.
9. PRIORIDAD: asigna strategicOrder (1=primero implementar). Orden típico: 1° gestión demanda (sin CAPEX, ROI inmediato), 2° eficiencia LED/equipos (CAPEX bajo, ROI 6–18 meses), 3° solar (CAPEX medio, ROI 3–5 años), 4° baterías (CAPEX alto, solo si apagones frecuentes, ROI 5–10 años, foco resiliencia).
10. LED: calcula ahorro como fracción del consumo total (NO cantidad de luminarias — sin inventario real). Fórmula: ahorro_LED = consumo_mensual_kWh × fracción_iluminación × 0,60. fracción: hotel 20% (15–25%), retail 15%, oficina 25%, industrial 10%. description: "basado en estimación del X% del consumo total (sin inventario físico de luminarias)".
11. INDICADORES FINANCIEROS (opcionales, capex solar/baterías): irr = TIR %/año ≈ 100/paybackAños (primer orden), npv = VAN COP (horizonte 20 años, descuento 12%, crecimiento tarifa 3%/año), lcoe = CAPEX / kWh_generados_20años (COP/kWh). Solo incluir si los datos disponibles lo permiten.
12. ADVERTENCIAS: campo "warnings" en el JSON raíz con array estándar (5 advertencias).
13. LENGUAJE CONSULTIVO: title y action deben usar tono de consultoría. "Se recomienda implementar un sistema solar de X kWp..." en vez de "Instalar paneles". "Se propone la reconstrucción tecnológica de iluminación..." en vez de "Cambiar luminarias".

Responde ÚNICAMENTE con JSON válido, sin texto extra:
{
  "energyScore": <0-100>,
  "estimatedSavingsKwh": <kWh/mes, máximo ${70}% del consumo mensual>,
  "recommendations": [
    {
      "priority": "<critica|alta|media|baja>",
      "category": "<operacional|solar|baterias|demanda|eficiencia>",
      "impactType": "<economico|energetico|operativo>",
      "confidenceLevel": "<alta|media|baja>",
      "title": "<título específico>",
      "description": "<diagnóstico con datos reales de esta empresa, sin valores genéricos>",
      "assumptions": ["Tarifa: X COP/kWh", "PR: 0,75 (por defecto Colombia)", "Irradiancia P50 NASA: X kWh/m²/día", "Autoconsumo: X (tipo negocio)", "..."],
      "action": "<acción concreta con valores específicos>",
      "estimatedImpact": "<resultado en COP/mes con ±15% variabilidad, texto legible>",
      "savingsCopPerMonth": <número entero COP/mes — el servidor sumará esto para calcular el total>,
      "savingsCalculationExplanation": "<fórmula exacta con los números reales de este negocio>",
      "capex": { "minCop": <número>, "maxCop": <número>, "paybackMonths": <número>, "irr": <opcional %/año>, "npv": <opcional COP>, "lcoe": <opcional COP/kWh> },
      "scenarios": {
        "conservador": "<COP/mes con PR=0,72, irradiancia mínima histórica, −15%>",
        "realista": "<COP/mes con PR=0,75, irradiancia P50, autoconsumo del tipo de negocio>",
        "optimista": "<COP/mes con PR=0,78, irradiancia máxima histórica, +15%>"
      },
      "benchmark": "<comparación técnica real, ej: '1.400–1.800 kWh/kWp/año Caribe colombiano'>",
      "strategicOrder": <1–N, 1=primero implementar>,
      "warnings": ["<advertencia específica de esta recomendación si aplica>"]
    }
  ],
  "warnings": [
    "Resultados estimados sujetos a validación con auditoría energética certificada (RETIE)",
    "No incluye impuestos, notarías, trámites UPME ni costos de mantenimiento post-año-1",
    "Tarifa eléctrica Caribe puede variar según resoluciones CREG vigentes",
    "CAPEX orientativo — requiere cotización formal de instalador certificado RETIE",
    "Curva de carga no medida: factor de simultaneidad y autoconsumo son estimaciones"
  ]
}

Reglas finales:
- 4–6 recomendaciones, de mayor a menor ROI real, con strategicOrder asignado
- capex y scenarios OBLIGATORIOS para "solar" y "baterias"
- savingsCopPerMonth OBLIGATORIO en CADA recomendación (número entero, el servidor lo suma)
- estimatedSavingsKwh = round(sum(savingsCopPerMonth) / tarifa) — debe ser la suma exacta
- assumptions siempre incluye: fuente P50 NASA POWER, tarifa COP/kWh, PR=0,75, factor 0,85 Caribe, autoconsumo
- iluminación: calcular como fracción del consumo total (hotel 20%), NO inventario de luminarias
- CAPEX baterías: 2,0–3,0 M COP/kWh (40–60M para 20kWh); baterías: savingsCopPerMonth = costo evitado (ahorro energético = 0)
- payback incluye degradación: CAPEX / (ahorro_año1 × 0,988) × 12
- On-Grid NO produce de noche: NUNCA "autoconsumo nocturno"
- CADA recomendación usa exclusivamente los números del contexto provisto
- warnings top-level OBLIGATORIO: incluir el array estándar de 5 advertencias`;
        const isDay = request.analysisHour >= 6 && request.analysisHour <= 18;
        const isPeak = request.analysisHour >= 10 && request.analysisHour <= 15;
        const irradianceSource = fin.todayIrradiance !== null ? `dato real del día ${fin.todayIrradiance.toFixed(2)} kWh/m²/día (solo contextual, NO usar en financieros)` : `dato de hoy no disponible aún en NASA POWER`;
        const userPrompt = `Analiza esta empresa y genera recomendaciones usando EXCLUSIVAMENTE los datos reales NASA POWER que aparecen a continuación. NO uses valores de entrenamiento ni irradiancias genéricas.

━━━ TRAZABILIDAD DE DATOS ━━━
Fuente: NASA POWER API | Variable: ALLSKY_SFC_SW_DWN | Período: 2019-01-01 → ${request.currentDate}
Latitud/Longitud: ${request.location}
🔢 Irradiancia promedio histórica (NASA POWER, P50): **${fin.p50Irradiance} kWh/m²/día** ← USA ESTE VALOR en TODOS los cálculos financieros
Rango histórico: ${fin.historicalMin}–${fin.historicalMax} kWh/m²/día (usar en scenarios: conservador ↔ optimista)
Promedio 30 días recientes: ${fin.avgIrradiance} kWh/m²/día (solo contextual)
Dato más reciente NASA: ${irradianceSource}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📅 Fecha y Hora del Análisis
${request.datetimeLabel}
Hora: ${request.analysisHour}:00 h | Estado solar: **${request.solarCondition}**
${isPeak ? '⚡ HORA PICO SOLAR: máxima generación fotovoltaica.' : isDay ? '☀️ Generación solar activa (pico máximo: 10h–15h).' : '🌙 Noche: sin generación solar. Foco en baterías y programación de cargas.'}
Temporada: ${fin.season}

## ⚡ Perfil Energético
${profile.toSummaryString()}
Consumo mensual: ${profile.monthlyConsumptionKwh} kWh/mes | Diario: ${fin.dailyConsumptionKwh} kWh/día
Factura mensual estimada: ${fin.monthlyBillCop.toLocaleString('es-CO')} COP/mes
Cargo potencia máxima: ${fin.demandChargeCopPerMonth.toLocaleString('es-CO')} COP/mes (${profile.peakDemandKw} kW × 16.000)
⚠️ Ahorro máximo aplicable: **${fin.maxSavingsCapKwh} kWh/mes** (límite físico = 70% del consumo)

## ☀️ Histórico Real NASA POWER (últimos 15 días)
${dataTable}

## 📊 Resumen Histórico Completo (NASA POWER 2019–hoy)
${request.solarDataSummary}

## 💰 Financieros Pre-computados (NO recalcular irradiancia, usar estos valores)
- Irradiancia P50 (mediana histórica NASA POWER): **${fin.p50Irradiance} kWh/m²/día** ← único valor para cálculos
- PR sistema: **${fin.pr}** (conservador estándar Colombia)
- Factor de autoconsumo (${profile.businessType}): **${fin.autoconsumoFactor}**
- Factor pérdidas Caribe: **${fin.lossesFactorCaribe}** (temperatura inversor, ensuciamiento, sombras, degradación inicial)
- Fórmula: E = kW_pico × ${fin.p50Irradiance} P50 × ${fin.pr} PR × ${fin.lossesFactorCaribe} factor_Caribe × 30 días
- Ahorro = E × ${fin.autoconsumoFactor} autoconsumo × ${profile.electricityRateCopPerKwh} COP/kWh
- Capacidad solar: ${profile.hasSolarPanels ? `${profile.solarCapacityKw ?? '?'} kW (instalados)` : `${Math.ceil(profile.peakDemandKw * 0.4)} kW (propuesta On-Grid)`}
- Generación potencial/día: **${fin.potentialSolarGenKwhPerDay} kWh/día**
- Ahorro por autoconsumo: **${fin.potentialSolarSavingsCopPerMonth.toLocaleString('es-CO')} COP/mes**
- Benchmark: **${fin.annualKwhPerKwp} kWh/kWp/año** (límite superior Caribe: 1.800)
- Tarifa: ${profile.electricityRateCopPerKwh} COP/kWh

## 🎯 Instrucciones de Generación
1. Usa SOLO P50 (${fin.p50Irradiance} kWh/m²/día) en toda fórmula solar. El dato del día es solo contextual.
2. Ordena por ROI real: 1° demanda (sin inversión), 2° eficiencia, 3° solar, 4° baterías.
3. Factor de simultaneidad: usa siempre como rango (ej. "0,60–0,80 según operación"), nunca valor puntual.
4. Baterías: enfoca en CONTINUIDAD OPERATIVA (apagones Riohacha), no en arbitraje tarifario.
5. Benchmark solar: 1.400–1.800 kWh/kWp/año en Caribe colombiano. NO uses valores >2.000.
6. estimatedSavingsKwh total ≤ ${fin.maxSavingsCapKwh} kWh/mes. No sumes ahorros solapados.
7. savingsCalculationExplanation incluye factor Caribe: "X kW × ${fin.p50Irradiance} kWh/m²/día (P50) × ${fin.pr} PR × ${fin.lossesFactorCaribe} (factor Caribe) × 30 días × ${fin.autoconsumoFactor} autoconsumo × ${profile.electricityRateCopPerKwh} COP/kWh = resultado"
8. scenarios "conservador": PR=0,72 + irradiancia mínima ${fin.historicalMin} kWh/m²/día + factor ${fin.lossesFactorCaribe}. "optimista": PR=0,78 + máxima ${fin.historicalMax} kWh/m²/día + factor ${fin.lossesFactorCaribe}.
9. assumptions siempre incluye: "Irradiancia P50 NASA POWER: ${fin.p50Irradiance} kWh/m²/día", "PR: ${fin.pr}", "Factor pérdidas Caribe: ${fin.lossesFactorCaribe}", "Autoconsumo: ${fin.autoconsumoFactor}".
10. On-Grid sin baterías: NUNCA mencionar "autoconsumo nocturno" — el sistema no produce de noche.
11. En recomendación de demanda: añadir "Requiere validación con medición de curva de carga (15 min, 2 semanas)".`;
        ;
        return [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];
    }
    parseResponse(content, request) {
        try {
            const jsonContent = this.extractJsonObject(content);
            const parsed = llmResponseSchema.safeParse(JSON.parse(jsonContent));
            if (!parsed.success) {
                console.error('[OpenRouterLlmAdapter] Zod validation failed:', JSON.stringify(parsed.error.issues));
                return _Result.Result.ok(this.buildFallbackRecommendation(request));
            }
            const today = new Date().toISOString().split('T')[0];
            // Server-side sum: total = sum of individual savingsCopPerMonth / tariff → kWh
            // This guarantees the top-level total always equals the sum of recommendations.
            const tariff = request.energyProfile.electricityRateCopPerKwh;
            const totalSavingsCop = parsed.data.recommendations.reduce((s, r)=>s + r.savingsCopPerMonth, 0);
            const totalSavingsKwh = Math.round(totalSavingsCop / tariff);
            const cappedSavings = Math.min(totalSavingsKwh, request.preComputedFinancials.maxSavingsCapKwh);
            const recommendation = _Recommendation.Recommendation.create({
                businessName: request.energyProfile.businessName,
                businessType: request.energyProfile.businessType,
                date: today,
                recommendations: parsed.data.recommendations,
                energyScore: parsed.data.energyScore,
                estimatedSavings: cappedSavings,
                generatedAt: new Date()
            });
            return _Result.Result.ok(recommendation);
        } catch (err) {
            console.error('[OpenRouterLlmAdapter] Parse error:', err);
            return _Result.Result.ok(this.buildFallbackRecommendation(request));
        }
    }
    /**
   * Strips thinking tags (qwen3 chain-of-thought), fenced code blocks,
   * and extracts the first complete JSON object.
   */ extractJsonObject(content) {
        // 1. Strip <think>...</think> blocks (qwen3 extended thinking)
        let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        // 2. Strip markdown fenced code blocks
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        // 3. If it's already a valid JSON object, return it
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            return cleaned;
        }
        // 4. Find outermost { ... }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return cleaned.slice(firstBrace, lastBrace + 1);
        }
        throw new Error('No JSON object found in LLM response');
    }
    buildFallbackRecommendation(request) {
        const profile = request.energyProfile;
        const fin = request.preComputedFinancials;
        const monthlyCost = fin.monthlyBillCop;
        const irr = fin.p50Irradiance; // P50 median — NOT today's peak
        const autoconsumo = fin.autoconsumoFactor;
        const pr = fin.pr; // 0.75 default
        const tariff = profile.electricityRateCopPerKwh;
        const energyScore = Math.max(35, Math.min(92, Math.round(55 + (profile.hasSolarPanels ? 8 : 0) + (profile.hasBatteryStorage ? 7 : 0) + (profile.peakDemandKw > 30 ? 10 : 4))));
        const demandSavingsCop = Math.round(profile.peakDemandKw * 0.12 * 16000);
        const solarSavingsCop = fin.potentialSolarSavingsCopPerMonth;
        const solarCapKw = profile.hasSolarPanels ? profile.solarCapacityKw ?? Math.ceil(profile.peakDemandKw * 0.4) : Math.ceil(profile.peakDemandKw * 0.4);
        // Use pre-computed annual benchmark (capped at 1800 kWh/kWp/year)
        const annualGenKwhPerKwp = fin.annualKwhPerKwp;
        const recommendations = [
            {
                priority: 'critica',
                category: 'demanda',
                impactType: 'economico',
                confidenceLevel: 'alta',
                title: 'Reducir demanda máxima registrada',
                description: `Con ${profile.peakDemandKw} kW de demanda pico, el cargo fijo por potencia máxima representa ~${fin.demandChargeCopPerMonth.toLocaleString('es-CO')} COP/mes. Este cobro no depende del consumo sino del pico registrado.`,
                assumptions: [
                    `Tarifa potencia: 16.000 COP/kW/mes`,
                    `Reducción objetivo: 12%`,
                    `Factor de simultaneidad actual: alto (0,80–1,00 sin escalonamiento)`,
                    `Mejora esperada con escalonamiento: 0,60–0,75`,
                    `Requiere validación con medición de curva de carga (intervalos de 15 min, mínimo 2 semanas)`
                ],
                action: `Se propone una estrategia de gestión activa de demanda mediante escalonamiento de arranques de equipos. Meta: pico de ${Math.round(profile.peakDemandKw * 0.88)} kW (−12%). ROI inmediato: cero inversión requerida.`,
                estimatedImpact: `Ahorro de ${demandSavingsCop.toLocaleString('es-CO')} COP/mes (±15% variabilidad).`,
                savingsCopPerMonth: demandSavingsCop,
                savingsCalculationExplanation: `${profile.peakDemandKw} kW × 12% reducción × 16.000 COP/kW/mes = ${demandSavingsCop.toLocaleString('es-CO')} COP/mes`,
                scenarios: {
                    conservador: `${Math.round(profile.peakDemandKw * 0.06 * 16000).toLocaleString('es-CO')} COP/mes (−6%, factor simultaneidad 0,70–0,80 estimado)`,
                    realista: `${demandSavingsCop.toLocaleString('es-CO')} COP/mes (−12%, estimado según operación típica)`,
                    optimista: `${Math.round(profile.peakDemandKw * 0.18 * 16000).toLocaleString('es-CO')} COP/mes (−18%, con automatización completa)`
                },
                benchmark: `PYMES del sector con escalonamiento de cargas logran reducciones de demanda del 10–20%`,
                strategicOrder: 1
            },
            {
                priority: profile.hasSolarPanels ? 'media' : 'alta',
                category: 'solar',
                impactType: 'economico',
                confidenceLevel: fin.avgIrradiance > 0 ? 'alta' : 'media',
                title: profile.hasSolarPanels ? 'Maximizar autoconsumo fotovoltaico' : 'Instalar sistema solar On-Grid',
                description: `Irradiancia promedio histórica NASA POWER (P50): ${irr} kWh/m²/día. ${profile.hasSolarPanels ? `Con ${profile.solarCapacityKw ?? '?'} kW instalados: E = ${solarCapKw} kW × ${irr} kWh/m²/día × ${pr} PR × ${fin.lossesFactorCaribe} factor_Caribe = ${fin.potentialSolarGenKwhPerDay} kWh/día. Autoconsumo diurno esperado (${profile.businessType}): ${autoconsumo}.` : `Sistema propuesto: ${solarCapKw} kW. E = ${solarCapKw} kW × ${irr} kWh/m²/día × ${pr} PR × ${fin.lossesFactorCaribe} factor_Caribe = ${fin.potentialSolarGenKwhPerDay} kWh/día. Autoconsumo diurno (${profile.businessType}): ${autoconsumo}.`} El ahorro aplica exclusivamente a horas de producción solar (on-grid, sin generación nocturna).`,
                assumptions: [
                    `Tarifa: ${profile.electricityRateCopPerKwh} COP/kWh`,
                    `PR sistema: ${pr} (conservador, Colombia)`,
                    `Factor pérdidas Caribe: ${fin.lossesFactorCaribe} (temperatura inversor, ensuciamiento, sombras, degradación inicial)`,
                    `Irradiancia promedio histórica (NASA POWER, P50): ${irr} kWh/m²/día`,
                    `Factor de autoconsumo: ${autoconsumo} (${profile.businessType}) — SOLO generación diurna`,
                    `Degradación anual: 0,5%`,
                    `CAPEX incluye instalación, inversores, estructura, conexión y mantenimiento año 1`
                ],
                action: profile.hasSolarPanels ? `Se recomienda operar cargas intensivas (aires, bombas, refrigeración) exclusivamente entre 10:00 y 15:00, maximizando autoconsumo diurno y reduciendo exportación a red. El sistema on-grid no produce energía de noche.` : `Se recomienda implementar un sistema solar fotovoltaico On-Grid de ${solarCapKw} kWp como medida estructural de reducción de costos energéticos. Inversión estimada: ${(solarCapKw * 3500000).toLocaleString('es-CO')}–${(solarCapKw * 5500000).toLocaleString('es-CO')} COP.`,
                estimatedImpact: `Reducción de ${solarSavingsCop.toLocaleString('es-CO')} COP/mes en factura (±15% variabilidad).`,
                savingsCopPerMonth: solarSavingsCop,
                savingsCalculationExplanation: `${solarCapKw} kW × ${irr} kWh/m²/día (P50 NASA) × ${pr} PR × ${fin.lossesFactorCaribe} factor_Caribe × 30 días × ${autoconsumo} autoconsumo × ${profile.electricityRateCopPerKwh} COP/kWh = ${solarSavingsCop.toLocaleString('es-CO')} COP/mes`,
                capex: profile.hasSolarPanels ? undefined : {
                    minCop: solarCapKw * 3500000,
                    maxCop: solarCapKw * 5500000,
                    // payback with degradation: CAPEX / (ahorro_año1 × 0.988) × 12
                    paybackMonths: Math.round(solarCapKw * 4500000 / (Math.max(solarSavingsCop, 1) * 12 * 0.988))
                },
                scenarios: {
                    conservador: `${Math.round(solarCapKw * fin.historicalMin * 0.72 * fin.lossesFactorCaribe * 30 * autoconsumo * profile.electricityRateCopPerKwh).toLocaleString('es-CO')} COP/mes (PR=0,72, irradiancia mín. ${fin.historicalMin} kWh/m²/día, factor Caribe ${fin.lossesFactorCaribe})`,
                    realista: `${solarSavingsCop.toLocaleString('es-CO')} COP/mes (PR=${pr}, P50=${irr} kWh/m²/día, factor_Caribe=${fin.lossesFactorCaribe}, autoconsumo=${autoconsumo})`,
                    optimista: `${Math.round(solarCapKw * fin.historicalMax * 0.78 * fin.lossesFactorCaribe * 30 * autoconsumo * profile.electricityRateCopPerKwh).toLocaleString('es-CO')} COP/mes (PR=0,78, irradiancia máx. ${fin.historicalMax} kWh/m²/día, factor Caribe ${fin.lossesFactorCaribe})`
                },
                benchmark: `Región Caribe colombiano: 1.400–1.800 kWh/kWp/año (con factor Caribe 0,85). Estimado este sistema: ${annualGenKwhPerKwp} kWh/kWp/año`,
                strategicOrder: profile.hasSolarPanels ? 2 : 3
            },
            {
                priority: profile.hasBatteryStorage ? 'media' : 'baja',
                category: 'baterias',
                impactType: 'operativo',
                confidenceLevel: 'media',
                title: profile.hasBatteryStorage ? 'Optimizar ciclos de carga/descarga de baterías' : 'Evaluar almacenamiento para continuidad operativa',
                description: `En Riohacha los cortes de energía generan pérdidas directas. El valor principal de las baterías en Colombia es la CONTINUIDAD OPERATIVA (CREG 030/2018). Ahorro energético directo: 0 COP/mes. Beneficio real: continuidad operativa y prevención de pérdidas por cortes de Electrocaribeño. Evalúate baterías solo si los apagones impactan operación crítica.`,
                assumptions: [
                    `Horas de respaldo requeridas: 2–4 h`,
                    `Cargas críticas: ~${Math.round(profile.peakDemandKw * 0.3)} kW`,
                    `Tecnología: LiFePO4 (4.000–6.000 ciclos)`,
                    `CAPEX Colombia 2026: 2,0–3,0 M COP/kWh instalado (incluye BMS e instalación)`,
                    `Mantenimiento: 1–2% del CAPEX/año`,
                    `Beneficio económico principal: prevención de pérdidas por corte, NO arbitraje tarifario`
                ],
                action: profile.hasBatteryStorage ? `Se recomienda cargar baterías entre 10h–15h con excedente solar (autoconsumo diurno). Descargar ante cortes o picos de demanda > ${Math.round(profile.peakDemandKw * 0.85)} kW. Evaluar si inyección a red (CREG 030) es más rentable que almacenar.` : `Si los apagones son frecuentes: se recomienda analizar banco de ${Math.max(Math.round(profile.operatingHoursPerDay * profile.peakDemandKw * 0.15), 4)} kWh (LiFePO4) para cargas críticas. Evaluar primero net metering antes de invertir en almacenamiento.`,
                estimatedImpact: `Costo evitado estimado por continuidad operativa: ${Math.round(monthlyCost * 0.05).toLocaleString('es-CO')} COP/mes (±15%, según frecuencia de apagones). Ahorro energético directo: 0 COP/mes.`,
                savingsCopPerMonth: Math.round(monthlyCost * 0.05),
                savingsCalculationExplanation: `5% del costo mensual en pérdidas evitadas por continuidad: ${monthlyCost.toLocaleString('es-CO')} × 5% = ${Math.round(monthlyCost * 0.05).toLocaleString('es-CO')} COP/mes`,
                capex: profile.hasBatteryStorage ? undefined : (()=>{
                    // Battery capacity in kWh
                    const battKwh = Math.max(Math.round(profile.operatingHoursPerDay * profile.peakDemandKw * 0.15), 4);
                    const capexMin = battKwh * 2000000; // 2 M COP/kWh
                    const capexMax = battKwh * 3000000; // 3 M COP/kWh
                    const annualSavings = Math.round(monthlyCost * 0.05) * 12;
                    return {
                        minCop: capexMin,
                        maxCop: capexMax,
                        // payback with degradation factor 0.988
                        paybackMonths: Math.round((capexMin + capexMax) / 2 / (Math.max(annualSavings, 1) * 0.988))
                    };
                })(),
                scenarios: {
                    conservador: `${Math.round(monthlyCost * 0.02).toLocaleString('es-CO')} COP/mes (1 apagón/mes, −15%)`,
                    realista: `${Math.round(monthlyCost * 0.05).toLocaleString('es-CO')} COP/mes (2–3 apagones/mes)`,
                    optimista: `${Math.round(monthlyCost * 0.10).toLocaleString('es-CO')} COP/mes (apagones frecuentes + pico reducido, +15%)`
                }
            },
            {
                priority: 'media',
                category: 'eficiencia',
                impactType: 'energetico',
                confidenceLevel: 'baja',
                title: 'Reconversión tecnológica de iluminación LED + submedición por circuito',
                description: `Con ${profile.monthlyConsumptionKwh} kWh/mes y sin inventario físico de luminarias, el ahorro estimado se basa en la fracción de iluminación del consumo total (estimación genérica). Ahorro LED = consumo_iluminación × 60% = ${profile.monthlyConsumptionKwh} kWh/mes × 20% × 60% = ${Math.round(profile.monthlyConsumptionKwh * 0.20 * 0.60)} kWh/mes (basado en estimación del 20% del consumo total, sin inventario físico de luminarias). Confidencia baja hasta validación real.`,
                assumptions: [
                    `Fracción de iluminación estimada: 20% del consumo total (sin inventario físico)`,
                    `Eficiencia LED vs convencional: 60% reducción de consumo en iluminación`,
                    `Tarifa: ${profile.electricityRateCopPerKwh} COP/kWh`,
                    `Estimación sin auditoría física: confidencia baja — requiere validación con inventario real`
                ],
                action: 'Se propone la reconversión tecnológica de iluminación por LED de alta eficiencia (estimado sobre fracción de consumo, sin inventario físico). Complementar con medidores inteligentes por circuito y telemetría. Correlacionar consumo horario con irradiancia solar para identificar cargas desplazables al período solar (10h–15h).',
                estimatedImpact: `Ahorro estimado de ${Math.round(profile.monthlyConsumptionKwh * 0.20 * 0.60 * profile.electricityRateCopPerKwh).toLocaleString('es-CO')} COP/mes (±15%, sin inventario real de luminarias).`,
                savingsCopPerMonth: Math.round(profile.monthlyConsumptionKwh * 0.20 * 0.60 * profile.electricityRateCopPerKwh),
                savingsCalculationExplanation: `${profile.monthlyConsumptionKwh} kWh/mes × 20% fracción_iluminación × 60% eficiencia_LED × ${profile.electricityRateCopPerKwh} COP/kWh = ${Math.round(profile.monthlyConsumptionKwh * 0.20 * 0.60 * profile.electricityRateCopPerKwh).toLocaleString('es-CO')} COP/mes`,
                benchmark: `PYMES similares detectan 5–15% de consumo evitable al instalar monitoreo granular. Ahorro LED típico: 60% de la carga de iluminación`,
                strategicOrder: 2
            }
        ];
        // Compute total from sum of individual savings — guarantees consistency
        const totalSavingsCop = recommendations.reduce((s, r)=>s + r.savingsCopPerMonth, 0);
        const estimatedSavings = Math.min(Math.round(totalSavingsCop / tariff), fin.maxSavingsCapKwh);
        return _Recommendation.Recommendation.create({
            businessName: profile.businessName,
            businessType: profile.businessType,
            date: new Date().toISOString().split('T')[0],
            recommendations,
            energyScore,
            estimatedSavings,
            generatedAt: new Date()
        });
    }
    constructor(apiKey, model, baseUrl){
        _define_property(this, "httpClient", void 0);
        _define_property(this, "model", void 0);
        this.httpClient = new _HttpClient.HttpClient(baseUrl, 180000); // 180s timeout for LLM calls
        this.httpClient.setAuthHeader(apiKey);
        this.model = model;
    }
};

//# sourceMappingURL=OpenRouterLlmAdapter.js.map