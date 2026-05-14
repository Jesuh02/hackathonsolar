import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { NasaPowerApiAdapter } from '../modules/solar/infrastructure/adapters/NasaPowerApiAdapter';
import { SolarDataCacheRepository } from '../modules/solar/infrastructure/repositories/SolarDataCacheRepository';
import { GetSolarRadiationUseCase } from '../modules/solar/application/use-cases/GetSolarRadiationUseCase';
import { OpenRouterLlmAdapter } from '../modules/recommendations/infrastructure/adapters/OpenRouterLlmAdapter';
import { GenerateRecommendationsUseCase } from '../modules/recommendations/application/use-cases/GenerateRecommendationsUseCase';

dotenv.config();

/**
 * MCP Server - Agente Solar
 * Expone herramientas para que los LLMs consulten datos solares y generen recomendaciones
 */
async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'agente-solar-riohacha',
    version: '1.0.0',
  });

  // Inicializar dependencias
  const nasaAdapter = new NasaPowerApiAdapter(
    process.env.NASA_API_BASE_URL ?? 'https://power.larc.nasa.gov/api'
  );
  const repository = new SolarDataCacheRepository(
    parseInt(process.env.CACHE_TTL ?? '3600', 10)
  );
  const getSolarDataUseCase = new GetSolarRadiationUseCase(repository, nasaAdapter);

  const llmAdapter = new OpenRouterLlmAdapter(
    process.env.OPENROUTER_API_KEY ?? '',
    process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b',
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
  );
  const generateRecommendationsUseCase = new GenerateRecommendationsUseCase(
    llmAdapter,
    repository,
    nasaAdapter
  );

  // Herramienta 1: Consultar datos de radiación solar
  server.tool(
    'get_solar_radiation',
    'Obtiene datos históricos de radiación solar (irradiancia) para Riohacha, Colombia desde NASA POWER API',
    {
      startDate: z.string().describe('Fecha de inicio en formato YYYYMMDD (ej: 20230101)'),
      endDate: z.string().describe('Fecha de fin en formato YYYYMMDD (ej: 20231231)'),
      latitude: z.number().optional().describe('Latitud (default: 11.5444 - Riohacha)'),
      longitude: z.number().optional().describe('Longitud (default: -72.9072 - Riohacha)'),
    },
    async ({ startDate, endDate, latitude, longitude }) => {
      const result = await getSolarDataUseCase.execute({
        startDate,
        endDate,
        latitude,
        longitude,
      });

      if (result.isFailure) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }

      const data = result.value;
      const summary = [
        `## Datos de Radiación Solar - Riohacha, La Guajira`,
        `**Período**: ${startDate} - ${endDate}`,
        `**Registros**: ${data.data.length} días`,
        `**Irradiancia promedio**: ${data.stats.average} kWh/m²/día`,
        `**Irradiancia máxima**: ${data.stats.max} kWh/m²/día`,
        `**Irradiancia mínima**: ${data.stats.min} kWh/m²/día`,
        `**Irradiancia total**: ${data.stats.total} kWh/m²`,
        '',
        '### Muestra de datos recientes',
        ...data.data.slice(-7).map(
          (d) => `- ${d.date}: ${d.irradiance} kWh/m²/día (${d.radiationLevel})`
        ),
      ].join('\n');

      return {
        content: [
          { type: 'text', text: summary },
          { type: 'text', text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  // Herramienta 2: Generar recomendaciones energéticas
  server.tool(
    'generate_energy_recommendations',
    'Genera recomendaciones de ahorro energético para una empresa en Riohacha usando el Agente Solar IA',
    {
      businessName: z.string().describe('Nombre de la empresa'),
      businessType: z
        .enum(['hotel', 'hielera', 'retail', 'oficina', 'industrial'])
        .describe('Tipo de negocio'),
      monthlyConsumptionKwh: z.number().describe('Consumo mensual en kWh'),
      peakDemandKw: z.number().describe('Demanda máxima en kW'),
      operatingHoursPerDay: z.number().describe('Horas de operación por día'),
      hasSolarPanels: z.boolean().describe('¿Tiene paneles solares instalados?'),
      solarCapacityKw: z.number().optional().describe('Capacidad solar instalada en kW'),
      hasBatteryStorage: z.boolean().describe('¿Tiene almacenamiento en baterías?'),
      batteryCapacityKwh: z.number().optional().describe('Capacidad de baterías en kWh'),
      electricityRateCopPerKwh: z.number().optional().describe('Tarifa eléctrica COP/kWh (default: 750)'),
    },
    async (params) => {
      const result = await generateRecommendationsUseCase.execute({
        ...params,
        electricityRateCopPerKwh: params.electricityRateCopPerKwh ?? 750,
      });

      if (result.isFailure) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }

      const rec = result.value;
      const report = [
        `## Recomendaciones del Agente Solar para ${rec.businessName}`,
        `**Tipo de negocio**: ${rec.businessType}`,
        `**Puntuación energética**: ${rec.energyScore}/100`,
        `**Ahorro estimado**: ${rec.estimatedMonthlySavingsKwh} kWh/mes (~${rec.estimatedMonthlySavingsCop.toLocaleString('es-CO')} COP/mes)`,
        '',
        `### Contexto Solar`,
        `- Irradiancia promedio: ${rec.solarContext.averageIrradiance} kWh/m²/día`,
        `- Nivel de radiación: ${rec.solarContext.radiationLevel}`,
        `- Potencial solar: ${rec.solarContext.solarPotentialKwhPerDay} kWh/panel/día`,
        '',
        '### Recomendaciones',
        ...rec.recommendations.map(
          (r, i) =>
            `\n**${i + 1}. [${r.priority.toUpperCase()}] ${r.title}**\n` +
            `Categoría: ${r.category}\n` +
            `${r.description}\n` +
            `**Acción**: ${r.action}\n` +
            `**Impacto estimado**: ${r.estimatedImpact}`
        ),
      ].join('\n');

      return {
        content: [
          { type: 'text', text: report },
          { type: 'text', text: JSON.stringify(rec, null, 2) },
        ],
      };
    }
  );

  // Recurso: Información de la ubicación
  server.resource(
    'location-info',
    'solar://riohacha/info',
    async () => ({
      contents: [{
        uri: 'solar://riohacha/info',
        text: JSON.stringify({
          city: 'Riohacha',
          department: 'La Guajira',
          country: 'Colombia',
          latitude: 11.5444,
          longitude: -72.9072,
          climate: 'Tropical árido',
          averageAnnualIrradiance: '5.5-6.5 kWh/m²/día',
          solarPotential: 'MUY ALTO - Una de las zonas con mayor irradiancia de Colombia',
          electricityProblems: ['Apagones frecuentes', 'Voltaje inestable', 'Altas tarifas'],
          opportunities: [
            'Alta irradiancia todo el año',
            'Viento complementario para generación híbrida',
            'Programas de energías renovables del gobierno colombiano',
          ],
        }, null, 2),
      }],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Servidor Agente Solar iniciado correctamente');
}

startMcpServer().catch((err) => {
  console.error('[MCP] Error al iniciar servidor:', err);
  process.exit(1);
});
