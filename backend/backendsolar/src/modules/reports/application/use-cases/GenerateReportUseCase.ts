import {
  ReportGeneratorPort,
  ReportContent,
  ReportFormat,
  GenerateReportRequest,
  GenerateReportResponse,
  ChartData,
} from '../../domain/ports/ReportGeneratorPort';
import { NasaPowerApiPort } from '../../../solar/domain/ports/NasaPowerApiPort';
import { HttpClient } from '@shared/infrastructure/HttpClient';
import { Result } from '@shared/domain/Result';

interface OpenRouterMessage { role: 'system' | 'user'; content: string; }
interface OpenRouterResponse { choices: Array<{ message: { content: string } }> }

/**
 * GenerateReportUseCase
 * 1. Fetches NASA POWER solar data for the requested period
 * 2. Asks the LLM to produce structured JSON report content
 * 3. Passes it to the correct adapter (Excel / PDF / Word)
 */
export class GenerateReportUseCase {
  private readonly llmClient: HttpClient;

  constructor(
    private readonly nasaApi: NasaPowerApiPort,
    private readonly adapters: Record<ReportFormat, ReportGeneratorPort>,
    llmApiKey: string,
    llmModel: string,
    llmBaseUrl: string
  ) {
    this.llmClient = new HttpClient(llmBaseUrl);
    this.llmClient.setAuthHeader(llmApiKey);
    this.llmModel = llmModel;
  }

  private readonly llmModel: string;

  async execute(request: GenerateReportRequest): Promise<Result<GenerateReportResponse>> {
    const format = request.format ?? 'pdf';
    const adapter = this.adapters[format];
    if (!adapter) {
      return Result.fail<GenerateReportResponse>(`Formato '${format}' no soportado. Usa: excel, pdf, word`);
    }

    // ── Determine date range ──────────────────────────────────────────────
    // Default: full historical range 2019-01-01 → today (NASA POWER)
    const today = new Date();
    const defaultEnd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const startDate = request.startDate ?? '20190101';
    const endDate   = request.endDate   ?? defaultEnd;

    // ── Fetch solar data ──────────────────────────────────────────────────
    let solarData: Array<{ date: string; irradiance: number }> = [];
    const nasaResult = await this.nasaApi.fetchDailyRadiation({
      start: startDate,
      end: endDate,
      latitude: 11.5444,
      longitude: -72.9072,
      community: 'RE',
      parameters: ['ALLSKY_SFC_SW_DWN'],
    });
    if (nasaResult.isSuccess) {
      solarData = nasaResult.value.map((r) => ({ date: r.date, irradiance: r.irradiance }));
    } else {
      console.warn('[GenerateReportUseCase] NASA API warning:', nasaResult.error);
    }

    // ── Build data summary for LLM ────────────────────────────────────────
    const avgIrr = solarData.length
      ? (solarData.reduce((s, d) => s + d.irradiance, 0) / solarData.length).toFixed(2)
      : 'N/A';
    const maxIrr = solarData.length ? solarData.reduce((m, d) => d.irradiance > m ? d.irradiance : m, solarData[0].irradiance).toFixed(2) : 'N/A';
    const minIrr = solarData.length ? solarData.reduce((m, d) => d.irradiance < m ? d.irradiance : m, solarData[0].irradiance).toFixed(2) : 'N/A';

    const recent = solarData.slice(-30);
    const sampleTable = recent.map((d) => `${d.date}: ${d.irradiance.toFixed(2)} kWh/m²`).join('\n');

    // ── Ask LLM to generate report JSON ──────────────────────────────────
    const systemPrompt = `Eres un experto analista energético especializado en radiación solar y eficiencia energética para la ciudad de Riohacha, La Guajira, Colombia. Generas reportes profesionales en formato JSON estructurado. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown.`;

    const userPrompt = `Genera un reporte completo en español sobre: "${request.query}"

DATOS DE RADIACIÓN SOLAR (NASA POWER API):
- Ubicación: Riohacha, La Guajira, Colombia (11.5444°N, -72.9072°W)
- Período: ${startDate} a ${endDate}
- Irradiancia promedio: ${avgIrr} kWh/m²/día
- Máximo registrado: ${maxIrr} kWh/m²/día
- Mínimo registrado: ${minIrr} kWh/m²/día
- Días analizados: ${solarData.length}

Últimos 30 días (fecha: kWh/m²/día):
${sampleTable || 'Sin datos disponibles'}

Responde con este JSON exacto (sin markdown, sin código adicional):
{
  "title": "Título profesional del reporte",
  "subtitle": "Subtítulo descriptivo",
  "sections": [
    {
      "title": "Título de sección",
      "paragraphs": ["Párrafo 1...", "Párrafo 2..."],
      "keyMetrics": [
        {"label": "Métrica", "value": 0, "unit": "unidad"}
      ],
      "table": {
        "headers": ["Col1", "Col2", "Col3"],
        "rows": [["val", "val", 0]]
      }
    }
  ],
  "recommendations": ["Recomendación 1", "Recomendación 2"],
  "conclusion": "Conclusión ejecutiva del reporte"
}

Crea mínimo 4 secciones relevantes con datos reales. Incluye análisis histórico, estacionalidad, comparativas mensuales y proyecciones de energía solar.`;

    let reportContent: ReportContent;

    try {
      const llmResponse = await this.llmClient.post<OpenRouterResponse>('/chat/completions', {
        model: this.llmModel,
        messages: [
          { role: 'system', content: systemPrompt } as OpenRouterMessage,
          { role: 'user', content: userPrompt } as OpenRouterMessage,
        ],
        temperature: 0.4,
        max_tokens: 8000,
      });

      const rawContent = llmResponse.choices[0]?.message?.content ?? '';
      const jsonStr = this.extractJson(rawContent);
      const parsed = JSON.parse(jsonStr) as Omit<ReportContent, 'generatedAt' | 'period' | 'location'>;

      reportContent = {
        ...parsed,
        generatedAt: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
        period: {
          from: `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`,
          to: `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`,
        },
        location: 'Riohacha, La Guajira, Colombia',
        chartData: solarData.length ? this.computeChartData(solarData) : undefined,
      };
    } catch (e) {
      console.error('[GenerateReportUseCase] LLM parse error:', e);
      // Fallback: build a basic report from raw data
      reportContent = this.buildFallbackContent(request.query, solarData, startDate, endDate, avgIrr, maxIrr, minIrr);
      if (solarData.length) reportContent.chartData = this.computeChartData(solarData);
    }

    try {
      const buffer = await adapter.generate(reportContent);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `reporte-solar-riohacha-${ts}.${adapter.fileExtension}`;
      return Result.ok<GenerateReportResponse>({ buffer, filename, mimeType: adapter.mimeType });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return Result.fail<GenerateReportResponse>(`Error al generar el archivo: ${msg}`);
    }
  }

  private computeChartData(data: Array<{ date: string; irradiance: number }>): ChartData {
    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const map = new Map<string, number[]>();
    for (const { date, irradiance } of data) {
      const key = `${date.slice(0, 4)}-${date.slice(4, 6)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(irradiance);
    }
    const sorted = Array.from(map.keys()).sort().slice(-12);
    return {
      labels: sorted.map((m) => `${MONTHS[parseInt(m.slice(5, 7), 10) - 1]} '${m.slice(2, 4)}`),
      values: sorted.map((m) => {
        const vals = map.get(m)!;
        return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      }),
      title: 'Radiación Solar Promedio Mensual (kWh/m²/día)',
    };
  }

  private extractJson(raw: string): string {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return raw.slice(firstBrace, lastBrace + 1);
    }
    return raw;
  }

  private buildFallbackContent(
    query: string,
    data: Array<{ date: string; irradiance: number }>,
    startDate: string,
    endDate: string,
    avg: string,
    max: string,
    min: string
  ): ReportContent {
    const rows: Array<[string, string]> = data.slice(-20).map((d) => [
      `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`,
      `${d.irradiance.toFixed(2)} kWh/m²`,
    ]);

    return {
      title: `Reporte Solar – Riohacha`,
      subtitle: query,
      generatedAt: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      period: {
        from: `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`,
        to: `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`,
      },
      location: 'Riohacha, La Guajira, Colombia',
      sections: [
        {
          title: 'Resumen de Radiación Solar',
          keyMetrics: [
            { label: 'Promedio diario', value: avg, unit: 'kWh/m²' },
            { label: 'Máximo registrado', value: max, unit: 'kWh/m²' },
            { label: 'Mínimo registrado', value: min, unit: 'kWh/m²' },
            { label: 'Días analizados', value: data.length, unit: 'días' },
          ],
          paragraphs: [
            'Riohacha presenta una de las mayores irradiancias del país, favoreciendo la generación solar fotovoltaica.',
          ],
          table: {
            headers: ['Fecha', 'Irradiancia GHI'],
            rows,
          },
        },
      ],
      recommendations: [
        'Instalar sistemas fotovoltaicos aprovechando la alta irradiancia de Riohacha.',
        'Monitorear el consumo en horas pico (10:00-15:00) para maximizar el autoconsumo solar.',
      ],
      conclusion: 'Riohacha dispone de excelente recurso solar todo el año para proyectos de energía renovable.',
    };
  }
}
