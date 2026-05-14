"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
const _stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
const _zod = require("zod");
const _dotenv = /*#__PURE__*/ _interop_require_default(require("dotenv"));
const _NasaPowerApiAdapter = require("../modules/solar/infrastructure/adapters/NasaPowerApiAdapter");
const _SolarDataCacheRepository = require("../modules/solar/infrastructure/repositories/SolarDataCacheRepository");
const _GetSolarRadiationUseCase = require("../modules/solar/application/use-cases/GetSolarRadiationUseCase");
const _OpenRouterLlmAdapter = require("../modules/recommendations/infrastructure/adapters/OpenRouterLlmAdapter");
const _GenerateRecommendationsUseCase = require("../modules/recommendations/application/use-cases/GenerateRecommendationsUseCase");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
_dotenv.default.config();
/**
 * MCP Server - Agente Solar
 * Expone herramientas para que los LLMs consulten datos solares y generen recomendaciones
 */ async function startMcpServer() {
    const server = new _mcp.McpServer({
        name: 'agente-solar-riohacha',
        version: '1.0.0'
    });
    // Inicializar dependencias
    const nasaAdapter = new _NasaPowerApiAdapter.NasaPowerApiAdapter(process.env.NASA_API_BASE_URL ?? 'https://power.larc.nasa.gov/api');
    const repository = new _SolarDataCacheRepository.SolarDataCacheRepository(parseInt(process.env.CACHE_TTL ?? '3600', 10));
    const getSolarDataUseCase = new _GetSolarRadiationUseCase.GetSolarRadiationUseCase(repository, nasaAdapter);
    const llmAdapter = new _OpenRouterLlmAdapter.OpenRouterLlmAdapter(process.env.OPENROUTER_API_KEY ?? '', process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b', process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1');
    const generateRecommendationsUseCase = new _GenerateRecommendationsUseCase.GenerateRecommendationsUseCase(llmAdapter, repository, nasaAdapter);
    // Herramienta 1: Consultar datos de radiación solar
    server.tool('get_solar_radiation', 'Obtiene datos históricos de radiación solar (irradiancia) para Riohacha, Colombia desde NASA POWER API', {
        startDate: _zod.z.string().describe('Fecha de inicio en formato YYYYMMDD (ej: 20230101)'),
        endDate: _zod.z.string().describe('Fecha de fin en formato YYYYMMDD (ej: 20231231)'),
        latitude: _zod.z.number().optional().describe('Latitud (default: 11.5444 - Riohacha)'),
        longitude: _zod.z.number().optional().describe('Longitud (default: -72.9072 - Riohacha)')
    }, async ({ startDate, endDate, latitude, longitude })=>{
        const result = await getSolarDataUseCase.execute({
            startDate,
            endDate,
            latitude,
            longitude
        });
        if (result.isFailure) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${result.error}`
                    }
                ],
                isError: true
            };
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
            ...data.data.slice(-7).map((d)=>`- ${d.date}: ${d.irradiance} kWh/m²/día (${d.radiationLevel})`)
        ].join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: summary
                },
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2)
                }
            ]
        };
    });
    // Herramienta 2: Generar recomendaciones energéticas
    server.tool('generate_energy_recommendations', 'Genera recomendaciones de ahorro energético para una empresa en Riohacha usando el Agente Solar IA', {
        businessName: _zod.z.string().describe('Nombre de la empresa'),
        businessType: _zod.z.enum([
            'hotel',
            'hielera',
            'retail',
            'oficina',
            'industrial'
        ]).describe('Tipo de negocio'),
        monthlyConsumptionKwh: _zod.z.number().describe('Consumo mensual en kWh'),
        peakDemandKw: _zod.z.number().describe('Demanda máxima en kW'),
        operatingHoursPerDay: _zod.z.number().describe('Horas de operación por día'),
        hasSolarPanels: _zod.z.boolean().describe('¿Tiene paneles solares instalados?'),
        solarCapacityKw: _zod.z.number().optional().describe('Capacidad solar instalada en kW'),
        hasBatteryStorage: _zod.z.boolean().describe('¿Tiene almacenamiento en baterías?'),
        batteryCapacityKwh: _zod.z.number().optional().describe('Capacidad de baterías en kWh'),
        electricityRateCopPerKwh: _zod.z.number().optional().describe('Tarifa eléctrica COP/kWh (default: 750)')
    }, async (params)=>{
        const result = await generateRecommendationsUseCase.execute({
            ...params,
            electricityRateCopPerKwh: params.electricityRateCopPerKwh ?? 750
        });
        if (result.isFailure) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${result.error}`
                    }
                ],
                isError: true
            };
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
            ...rec.recommendations.map((r, i)=>`\n**${i + 1}. [${r.priority.toUpperCase()}] ${r.title}**\n` + `Categoría: ${r.category}\n` + `${r.description}\n` + `**Acción**: ${r.action}\n` + `**Impacto estimado**: ${r.estimatedImpact}`)
        ].join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: report
                },
                {
                    type: 'text',
                    text: JSON.stringify(rec, null, 2)
                }
            ]
        };
    });
    // Recurso: Información de la ubicación
    server.resource('location-info', 'solar://riohacha/info', async ()=>({
            contents: [
                {
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
                        electricityProblems: [
                            'Apagones frecuentes',
                            'Voltaje inestable',
                            'Altas tarifas'
                        ],
                        opportunities: [
                            'Alta irradiancia todo el año',
                            'Viento complementario para generación híbrida',
                            'Programas de energías renovables del gobierno colombiano'
                        ]
                    }, null, 2)
                }
            ]
        }));
    const transport = new _stdio.StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] Servidor Agente Solar iniciado correctamente');
}
startMcpServer().catch((err)=>{
    console.error('[MCP] Error al iniciar servidor:', err);
    process.exit(1);
});

//# sourceMappingURL=server.js.map