import { LlmPort, LlmRecommendationRequest } from '../../domain/ports/LlmPort';
import { Recommendation, RecommendationItem } from '../../domain/entities/Recommendation';
import { Result } from '@shared/domain/Result';
import { HttpClient } from '@shared/infrastructure/HttpClient';
import { z } from 'zod';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const recommendationItemSchema = z.object({
  priority: z.enum(['critica', 'alta', 'media', 'baja']),
  category: z.enum(['operacional', 'solar', 'baterias', 'demanda', 'eficiencia']),
  title: z.string().min(3),
  description: z.string().min(10),
  action: z.string().min(5),
  estimatedImpact: z.string().min(3),
  savingsCalculationExplanation: z.string().optional(),
});

const llmResponseSchema = z.object({
  energyScore: z.number().min(0).max(100),
  estimatedSavingsKwh: z.number().nonnegative(),
  recommendations: z.array(recommendationItemSchema).min(1),
});

/**
 * Adaptador OpenRouter - implementa LlmPort
 * Usa Qwen3 para generar recomendaciones energéticas inteligentes
 */
export class OpenRouterLlmAdapter implements LlmPort {
  private readonly httpClient: HttpClient;
  private readonly model: string;

  constructor(apiKey: string, model: string, baseUrl: string) {
    this.httpClient = new HttpClient(baseUrl);
    this.httpClient.setAuthHeader(apiKey);
    this.model = model;
  }

  async generateEnergyRecommendations(
    request: LlmRecommendationRequest
  ): Promise<Result<Recommendation>> {
    try {
      const messages = this.buildPrompt(request);
      const response = await this.httpClient.post<OpenRouterResponse>('/chat/completions', {
        model: this.model,
        messages,
        temperature: 0.65,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return Result.ok<Recommendation>(this.buildFallbackRecommendation(request));
      }

      return this.parseResponse(content, request);
    } catch (error) {
      console.error('[OpenRouterLlmAdapter] LLM call failed:', error);
      return Result.ok<Recommendation>(this.buildFallbackRecommendation(request));
    }
  }

  private buildPrompt(request: LlmRecommendationRequest): OpenRouterMessage[] {
    const { preComputedFinancials: fin, energyProfile: profile } = request;

    // Format last 30 days of irradiance as a compact table (most recent 15 days shown)
    const recentData = request.rawDailyData.slice(-15);
    const dataTable = recentData.map(d => {
      const dateStr = `${d.date.slice(0,4)}-${d.date.slice(4,6)}-${d.date.slice(6,8)}`;
      const bar = '█'.repeat(Math.round(d.irradiance));
      return `  ${dateStr}: ${d.irradiance.toFixed(2)} kWh/m² ${bar}`;
    }).join('\n');

    const systemPrompt = `Eres el Agente Solar, experto certificado en eficiencia energética y energía solar fotovoltaica para PYMES en Riohacha, La Guajira, Colombia. Analizas datos reales de la API NASA POWER y perfiles de consumo empresarial para emitir recomendaciones accionables con cálculos financieros precisos.

Contexto regional obligatorio a aplicar:
- Riohacha: irradiancia 5.0–7.2 kWh/m²/día según temporada y nubosidad costera
- Tarifa eléctrica Caribe regulada: 600–950 COP/kWh (varía por estrato y consumo)
- Cargo de potencia máxima Electrocaribeño: ~16.000 COP/kW/mes  
- Problemas crónicos: picos de demanda, microcortes, facturación por potencia máxima
- La energía eléctrica representa el 28–40% del OpEx de PYMES locales
- Temporada seca (nov–abr): irradiancia alta y estable
- Temporada de lluvias (may–oct): irradiancia más variable con nubes convectivas

Reglas de cálculo para estimatedImpact:
- Ahorro por autoconsumo solar = kWh_generados_día × 30 × tarifa_COP
- Ahorro por reducción de demanda = kW_reducidos × 16.000 COP/kW/mes
- Ahorro por eficiencia = kWh_ahorrados × tarifa_COP
- Siempre usa los números reales provistos en el contexto financiero

Responde ÚNICAMENTE con un JSON válido, sin texto previo ni posterior, con esta estructura:
{
  "energyScore": <número 0-100>,
  "estimatedSavingsKwh": <kWh/mes totales estimados a ahorrar>,
  "recommendations": [
    {
      "priority": "<critica|alta|media|baja>",
      "category": "<operacional|solar|baterias|demanda|eficiencia>",
      "title": "<título conciso y específico>",
      "description": "<problema específico basado en los datos reales de esta empresa>",
      "action": "<acción concreta con hora, kW o COP específicos>",
      "estimatedImpact": "<resultado cuantificado en COP/mes o kWh/mes>",
      "savingsCalculationExplanation": "<fórmula usada: ej. '30 días × 12,4 kWh/día × 750 COP/kWh = 279.000 COP/mes'>"
    }
  ]
}

Genera entre 4 y 6 recomendaciones ordenadas de mayor a menor prioridad. CADA recomendación debe usar los números reales provistos.`;

    const isDay = request.analysisHour >= 6 && request.analysisHour <= 18;
    const isPeak = request.analysisHour >= 10 && request.analysisHour <= 15;

    const userPrompt = `Analiza esta empresa y genera recomendaciones basadas en los datos reales:

## 📍 Ubicación
${request.location}

## 📅 Fecha y Hora del Análisis
${request.datetimeLabel}
Hora: ${request.analysisHour}:00 h | Estado solar ahora: **${request.solarCondition}**
${isPeak
  ? '⚡ HORA PICO SOLAR: Los paneles están generando al máximo. Prioriza carga de baterías y consumo de cargas pesadas AHORA.'
  : isDay
    ? `☀️ Hay generación solar activa pero no en el pico máximo (pico es 10h–15h).`
    : '🌙 Es de noche. No hay generación solar. Foco en baterías, reducción nocturna y preparación para mañana.'}
Temporada actual: ${fin.season}

## ⚡ Perfil Energético de la Empresa
${profile.toSummaryString()}
Consumo diario promedio: ${fin.dailyConsumptionKwh} kWh/día
Factura mensual estimada: ${fin.monthlyBillCop.toLocaleString('es-CO')} COP/mes
Cargo por demanda máxima estimado: ${fin.demandChargeCopPerMonth.toLocaleString('es-CO')} COP/mes (${profile.peakDemandKw} kW × 16.000)

## ☀️ Datos Reales de Radiación Solar (últimos 15 días)
${dataTable}

## 📊 Estadísticas del Período (últimos 30 días)
${request.solarDataSummary}

## 💰 Cálculos Financieros Pre-computados (úsalos en tus recomendaciones)
- Irradiancia promedio real: ${fin.avgIrradiance} kWh/m²/día
- Generación solar potencial: ${fin.potentialSolarGenKwhPerDay} kWh/día (${profile.hasSolarPanels ? `con ${profile.solarCapacityKw ?? '?'} kW instalados` : `estimado con ${Math.ceil(profile.peakDemandKw * 0.4)} kW`} × η=80%)
- Ahorro potencial por autoconsumo: ${fin.potentialSolarSavingsCopPerMonth.toLocaleString('es-CO')} COP/mes
- Tarifa actual del cliente: ${profile.electricityRateCopPerKwh} COP/kWh

## 🎯 Instrucciones Específicas
1. Si la empresa NO tiene paneles solares y el consumo mensual es alto, pon como "critica" la instalación solar con el ROI calculado
2. La recomendación de demanda debe cuantificar cuántos kW reducir y cuántos COP ahorra
3. Para la hora actual (${request.analysisHour}h): ${isPeak ? 'recomienda acciones inmediatas para aprovechar el pico solar de AHORA' : isDay ? 'recomienda preparación para el pico solar o gestión de energía diurna' : 'recomienda gestión nocturna: control de baterías, reducción stand-by, programación de cargas para mañana'}
4. Incluye en savingsCalculationExplanation la fórmula exacta usada con los números de este negocio`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private parseResponse(
    content: string,
    request: LlmRecommendationRequest
  ): Result<Recommendation> {
    try {
      const jsonContent = this.extractJsonObject(content);
      const parsed = llmResponseSchema.safeParse(JSON.parse(jsonContent));

      if (!parsed.success) {
        console.error('[OpenRouterLlmAdapter] Zod validation failed:', JSON.stringify(parsed.error.issues));
        return Result.ok<Recommendation>(this.buildFallbackRecommendation(request));
      }

      const today = new Date().toISOString().split('T')[0];
      const recommendation = Recommendation.create({
        businessName: request.energyProfile.businessName,
        businessType: request.energyProfile.businessType,
        date: today,
        recommendations: parsed.data.recommendations as RecommendationItem[],
        energyScore: parsed.data.energyScore,
        estimatedSavings: parsed.data.estimatedSavingsKwh,
        generatedAt: new Date(),
      });

      return Result.ok<Recommendation>(recommendation);
    } catch (err) {
      console.error('[OpenRouterLlmAdapter] Parse error:', err);
      return Result.ok<Recommendation>(this.buildFallbackRecommendation(request));
    }
  }

  /**
   * Strips thinking tags (qwen3 chain-of-thought), fenced code blocks,
   * and extracts the first complete JSON object.
   */
  private extractJsonObject(content: string): string {
    // 1. Strip <think>...</think> blocks (qwen3 extended thinking)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Strip markdown fenced code blocks
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

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

  private buildFallbackRecommendation(request: LlmRecommendationRequest): Recommendation {
    const profile = request.energyProfile;
    const fin = request.preComputedFinancials;
    const monthlyCost = fin.monthlyBillCop;
    const baseSavingsFactor = profile.hasSolarPanels ? 0.08 : 0.18;
    const estimatedSavings = Math.round(profile.monthlyConsumptionKwh * baseSavingsFactor);
    const energyScore = Math.max(
      35,
      Math.min(
        92,
        Math.round(
          55 +
            (profile.hasSolarPanels ? 8 : 0) +
            (profile.hasBatteryStorage ? 7 : 0) +
            (profile.peakDemandKw > 30 ? 10 : 4)
        )
      )
    );

    const demandSavingsCop = Math.round(profile.peakDemandKw * 0.12 * 16000);
    const solarSavingsCop = fin.potentialSolarSavingsCopPerMonth;

    const recommendations: RecommendationItem[] = [
      {
        priority: 'critica',
        category: 'demanda',
        title: 'Reducir demanda máxima registrada',
        description: `Con ${profile.peakDemandKw} kW de demanda pico, el cargo fijo por potencia máxima representa ~${fin.demandChargeCopPerMonth.toLocaleString('es-CO')} COP/mes. Este cobro no depende del consumo sino del pico registrado.`,
        action: `Programar arranque escalonado de equipos. No encender simultáneamente aires acondicionados, bombas y equipos de cocción. Objetivo: reducir el pico a ${Math.round(profile.peakDemandKw * 0.88)} kW (−12%).`,
        estimatedImpact: `Ahorro de ${demandSavingsCop.toLocaleString('es-CO')} COP/mes por reducción de cargo de potencia máxima.`,
        savingsCalculationExplanation: `${profile.peakDemandKw} kW × 12% reducción × 16.000 COP/kW/mes = ${demandSavingsCop.toLocaleString('es-CO')} COP/mes`,
      },
      {
        priority: profile.hasSolarPanels ? 'media' : 'alta',
        category: 'solar',
        title: profile.hasSolarPanels ? 'Maximizar autoconsumo fotovoltaico' : 'Instalar paneles solares: ROI positivo en Riohacha',
        description: `Irradiancia promedio real en tu ubicación: ${fin.avgIrradiance} kWh/m²/día. ${profile.hasSolarPanels ? `Con ${profile.solarCapacityKw ?? '?'} kW instalados, la generación potencial es de ${fin.potentialSolarGenKwhPerDay} kWh/día.` : `Riohacha tiene una de las irradiancias más altas de Colombia. Un sistema de ${Math.ceil(profile.peakDemandKw * 0.4)} kW generaría ${fin.potentialSolarGenKwhPerDay} kWh/día.`}`,
        action: profile.hasSolarPanels
          ? `Operar cargas intensivas (aires, bombas, refrigeración) entre 10:00 y 15:00 cuando la generación es máxima. Evita comprar energía a la red en ese horario.`
          : `Cotizar sistema fotovoltaico de ${Math.ceil(profile.peakDemandKw * 0.4)} kW conectado a red para cubrir cargas diurnas base.`,
        estimatedImpact: `Reducción de ${solarSavingsCop.toLocaleString('es-CO')} COP/mes en factura eléctrica.`,
        savingsCalculationExplanation: `${fin.potentialSolarGenKwhPerDay} kWh/día × 30 días × ${profile.electricityRateCopPerKwh} COP/kWh = ${solarSavingsCop.toLocaleString('es-CO')} COP/mes`,
      },
      {
        priority: profile.hasBatteryStorage ? 'media' : 'alta',
        category: 'baterias',
        title: profile.hasBatteryStorage ? 'Optimizar ciclos de carga/descarga de baterías' : 'Evaluar almacenamiento para continuidad y ahorro nocturno',
        description: 'Los apagones en la red de Riohacha afectan operación y generan pérdidas. Las baterías permiten también reducir el consumo en horas de tarifa alta y respaldar cargas críticas.',
        action: profile.hasBatteryStorage
          ? `Cargar baterías entre 10h–15h con excedente solar. Descargar en horas nocturnas o ante microcortes. Programar descarga parcial si la demanda sube de ${Math.round(profile.peakDemandKw * 0.85)} kW.`
          : `Analizar banco de baterías de ${Math.round(profile.operatingHoursPerDay * profile.peakDemandKw * 0.25)} kWh para respaldar las cargas críticas durante apagones.`,
        estimatedImpact: profile.hasBatteryStorage
          ? `Reducción del costo en horas nocturnas y prevención de pérdidas por apagón.`
          : `Reducción de pérdidas por cortes y posible ahorro de ${Math.round(monthlyCost * 0.07).toLocaleString('es-CO')} COP/mes.`,
        savingsCalculationExplanation: profile.hasBatteryStorage
          ? `Ahorro en energía nocturna: horas nocturnas × kWh_batería × ${profile.electricityRateCopPerKwh} COP/kWh`
          : `Estimado en el 7% del costo mensual: ${monthlyCost.toLocaleString('es-CO')} × 7% = ${Math.round(monthlyCost * 0.07).toLocaleString('es-CO')} COP/mes`,
      },
      {
        priority: 'media',
        category: 'eficiencia',
        title: 'Submedición por circuito para detectar desperdicios',
        description: `Con ${profile.monthlyConsumptionKwh} kWh/mes (${fin.dailyConsumptionKwh} kWh/día), sin medición granular es imposible identificar equipos anómalos o circuitos ineficientes.`,
        action: 'Instalar medidores inteligentes por circuito o tablero con telemetría. Correlacionar consumo horario con irradiancia solar para detectar cargas que pueden desplazarse al período solar.',
        estimatedImpact: `Ahorro adicional estimado de ${Math.round(monthlyCost * 0.05).toLocaleString('es-CO')} COP/mes al identificar y corregir ineficiencias.`,
        savingsCalculationExplanation: `Ahorro típico por submedición: 5% del costo mensual. ${monthlyCost.toLocaleString('es-CO')} × 5% = ${Math.round(monthlyCost * 0.05).toLocaleString('es-CO')} COP/mes`,
      },
    ];

    return Recommendation.create({
      businessName: profile.businessName,
      businessType: profile.businessType,
      date: new Date().toISOString().split('T')[0],
      recommendations,
      energyScore,
      estimatedSavings,
      generatedAt: new Date(),
    });
  }
}
