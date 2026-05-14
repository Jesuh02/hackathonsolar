"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
require("dotenv/config");
const _express = /*#__PURE__*/ _interop_require_default(require("express"));
const _cors = /*#__PURE__*/ _interop_require_default(require("cors"));
const _NasaPowerApiAdapter = require("./modules/solar/infrastructure/adapters/NasaPowerApiAdapter");
const _SolarDataCacheRepository = require("./modules/solar/infrastructure/repositories/SolarDataCacheRepository");
const _OpenRouterLlmAdapter = require("./modules/recommendations/infrastructure/adapters/OpenRouterLlmAdapter");
const _YCloudWhatsAppAdapter = require("./modules/whatsapp/infrastructure/adapters/YCloudWhatsAppAdapter");
const _ExcelReportAdapter = require("./modules/reports/infrastructure/adapters/ExcelReportAdapter");
const _PdfReportAdapter = require("./modules/reports/infrastructure/adapters/PdfReportAdapter");
const _WordReportAdapter = require("./modules/reports/infrastructure/adapters/WordReportAdapter");
const _CloudflareR2ReportStorageAdapter = require("./modules/reports/infrastructure/adapters/CloudflareR2ReportStorageAdapter");
const _GetSolarRadiationUseCase = require("./modules/solar/application/use-cases/GetSolarRadiationUseCase");
const _GenerateRecommendationsUseCase = require("./modules/recommendations/application/use-cases/GenerateRecommendationsUseCase");
const _SendOtpUseCase = require("./modules/whatsapp/application/use-cases/SendOtpUseCase");
const _VerifyOtpUseCase = require("./modules/whatsapp/application/use-cases/VerifyOtpUseCase");
const _SendDailyRecommendationUseCase = require("./modules/whatsapp/application/use-cases/SendDailyRecommendationUseCase");
const _SendDailyToAllUsersUseCase = require("./modules/whatsapp/application/use-cases/SendDailyToAllUsersUseCase");
const _ChatWithLlmUseCase = require("./modules/whatsapp/application/use-cases/ChatWithLlmUseCase");
const _DailySchedulerService = require("./modules/whatsapp/application/services/DailySchedulerService");
const _GenerateReportUseCase = require("./modules/reports/application/use-cases/GenerateReportUseCase");
const _solarcontroller = require("./api/controllers/solar.controller");
const _recommendationscontroller = require("./api/controllers/recommendations.controller");
const _whatsappcontroller = require("./api/controllers/whatsapp.controller");
const _reportscontroller = require("./api/controllers/reports.controller");
const _companycontroller = require("./api/controllers/company.controller");
const _solarroutes = require("./api/routes/solar.routes");
const _recommendationsroutes = require("./api/routes/recommendations.routes");
const _whatsapproutes = require("./api/routes/whatsapp.routes");
const _reportsroutes = require("./api/routes/reports.routes");
const _companyroutes = require("./api/routes/company.routes");
const _errormiddleware = require("./api/middlewares/error.middleware");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function bootstrap() {
    const app = (0, _express.default)();
    const PORT = process.env.PORT ?? 3001;
    // ── CORS ──────────────────────────────────────────────────────────────
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        ...process.env.FRONTEND_URL ? [
            process.env.FRONTEND_URL
        ] : [],
        ...process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',').map((o)=>o.trim()) : []
    ];
    app.use((0, _cors.default)({
        origin: (origin, callback)=>{
            // Allow requests with no origin (curl, Postman, same-origin)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            // Allow any Railway or Vercel preview URL
            if (/\.up\.railway\.app$/.test(origin) || /\.vercel\.app$/.test(origin)) {
                return callback(null, true);
            }
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true
    }));
    app.use(_express.default.json());
    app.use(_express.default.urlencoded({
        extended: true
    }));
    // ── Infrastructure adapters ────────────────────────────────────────────
    const nasaAdapter = new _NasaPowerApiAdapter.NasaPowerApiAdapter(process.env.NASA_API_BASE_URL ?? 'https://power.larc.nasa.gov/api');
    const solarRepository = new _SolarDataCacheRepository.SolarDataCacheRepository(parseInt(process.env.CACHE_TTL ?? '3600', 10));
    const llmAdapter = new _OpenRouterLlmAdapter.OpenRouterLlmAdapter(process.env.OPENROUTER_API_KEY ?? '', process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b', process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1');
    const whatsAppAdapter = new _YCloudWhatsAppAdapter.YCloudWhatsAppAdapter(process.env.YCLOUD_API_KEY ?? '', process.env.YCLOUD_BASE_URL ?? 'https://api.ycloud.com/v2', process.env.YCLOUD_WHATSAPP_NUMBER ?? '');
    const reportStorage = new _CloudflareR2ReportStorageAdapter.CloudflareR2ReportStorageAdapter({
        accountId: process.env.R2_ACCOUNT_ID ?? '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        bucketName: process.env.R2_BUCKET_NAME ?? '',
        publicUrl: process.env.R2_PUBLIC_URL ?? ''
    });
    // ── Application use cases ──────────────────────────────────────────────
    const getSolarUseCase = new _GetSolarRadiationUseCase.GetSolarRadiationUseCase(solarRepository, nasaAdapter);
    const generateRecommendationsUseCase = new _GenerateRecommendationsUseCase.GenerateRecommendationsUseCase(llmAdapter, solarRepository, nasaAdapter);
    const sendOtpUseCase = new _SendOtpUseCase.SendOtpUseCase(whatsAppAdapter);
    const verifyOtpUseCase = new _VerifyOtpUseCase.VerifyOtpUseCase();
    const sendDailyRecUseCase = new _SendDailyRecommendationUseCase.SendDailyRecommendationUseCase(whatsAppAdapter, generateRecommendationsUseCase, process.env.WHATSAPP_COMPANY_PHONE ?? '', nasaAdapter);
    const chatWithLlmUseCase = new _ChatWithLlmUseCase.ChatWithLlmUseCase(nasaAdapter, process.env.OPENROUTER_API_KEY ?? '', process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b', process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1');
    const sendDailyToAllUseCase = new _SendDailyToAllUsersUseCase.SendDailyToAllUsersUseCase(whatsAppAdapter, generateRecommendationsUseCase, nasaAdapter);
    const generateReportUseCase = new _GenerateReportUseCase.GenerateReportUseCase(nasaAdapter, {
        excel: new _ExcelReportAdapter.ExcelReportAdapter(),
        pdf: new _PdfReportAdapter.PdfReportAdapter(),
        word: new _WordReportAdapter.WordReportAdapter()
    }, process.env.OPENROUTER_API_KEY ?? '', process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b', process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1');
    // ── Controllers ────────────────────────────────────────────────────────
    const solarController = new _solarcontroller.SolarController(getSolarUseCase);
    const recommendationsController = new _recommendationscontroller.RecommendationsController(generateRecommendationsUseCase);
    const whatsAppController = new _whatsappcontroller.WhatsAppController(sendOtpUseCase, verifyOtpUseCase, sendDailyRecUseCase, chatWithLlmUseCase, whatsAppAdapter, generateReportUseCase, reportStorage, sendDailyToAllUseCase);
    const reportsController = new _reportscontroller.ReportsController(generateReportUseCase);
    const companyController = new _companycontroller.CompanyController();
    // ── Routes ─────────────────────────────────────────────────────────────
    app.use('/api/solar', (0, _solarroutes.createSolarRoutes)(solarController));
    app.use('/api/recommendations', (0, _recommendationsroutes.createRecommendationsRoutes)(recommendationsController));
    app.use('/api/whatsapp', (0, _whatsapproutes.createWhatsAppRoutes)(whatsAppController));
    app.use('/api/reports', (0, _reportsroutes.createReportsRoutes)(reportsController));
    app.use('/api/companies', (0, _companyroutes.createCompanyRoutes)(companyController));
    // Health check
    app.get('/health', (_req, res)=>{
        res.json({
            status: 'ok',
            service: 'Agente Solar - Riohacha',
            version: '1.0.0',
            timestamp: new Date().toISOString()
        });
    });
    app.use(_errormiddleware.errorMiddleware);
    const server = app.listen(PORT, ()=>{
        console.log(`🌞 Agente Solar Backend corriendo en http://localhost:${PORT}`);
        console.log(`📡 NASA POWER API: ${process.env.NASA_API_BASE_URL}`);
        console.log(`🤖 LLM Model: ${process.env.OPENROUTER_MODEL}`);
        const ycloudReady = !!(process.env.YCLOUD_API_KEY && process.env.YCLOUD_WHATSAPP_NUMBER);
        console.log(`📱 WhatsApp: ${ycloudReady ? 'habilitado' : 'deshabilitado (faltan YCLOUD_API_KEY / YCLOUD_WHATSAPP_NUMBER)'}`);
        const r2ok = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL);
        console.log(`☁️  R2 Storage: ${r2ok ? '✅ configurado' : '❌ FALTAN VARIABLES (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL)'}`);
    });
    server.requestTimeout = 0;
    server.headersTimeout = 0;
    server.timeout = 0;
    // ── Auto-register WHATSAPP_COMPANY_PHONE in business_profiles ─────────
    // Ensures the configured phone always receives daily recommendations,
    // even if it was never manually inserted via the dashboard.
    const companyPhone = (process.env.WHATSAPP_COMPANY_PHONE ?? '').replace(/^\+/, '');
    if (companyPhone) {
        void (async ()=>{
            try {
                const { getSupabaseClient } = await Promise.resolve().then(()=>/*#__PURE__*/ _interop_require_wildcard(require("./shared/infrastructure/SupabaseClient")));
                const supabase = getSupabaseClient();
                const { data: existing } = await supabase.from('business_profiles').select('id, daily_recommendations_enabled').eq('phone', companyPhone).maybeSingle();
                if (!existing) {
                    await supabase.from('business_profiles').insert({
                        phone: companyPhone,
                        business_name: process.env.COMPANY_NAME ?? 'Mi Empresa',
                        business_type: process.env.COMPANY_TYPE ?? 'retail',
                        address: process.env.COMPANY_ADDRESS ?? 'Riohacha, La Guajira',
                        latitude: parseFloat(process.env.COMPANY_LAT ?? '11.5444'),
                        longitude: parseFloat(process.env.COMPANY_LNG ?? '-72.9072'),
                        monthly_consumption_kwh: parseFloat(process.env.COMPANY_KWH ?? '5000'),
                        peak_demand_kw: parseFloat(process.env.COMPANY_PEAK_KW ?? '20'),
                        operating_hours_per_day: parseInt(process.env.COMPANY_HOURS ?? '12', 10),
                        electricity_rate_cop_per_kwh: parseFloat(process.env.COMPANY_RATE ?? '750'),
                        has_solar_panels: process.env.COMPANY_HAS_SOLAR === 'true',
                        has_battery_storage: process.env.COMPANY_HAS_BATTERY === 'true',
                        daily_recommendations_enabled: true
                    });
                    console.log(`[Bootstrap] ✅ Perfil auto-registrado para ${companyPhone} con recomendaciones diarias activas.`);
                } else if (!existing.daily_recommendations_enabled) {
                    await supabase.from('business_profiles').update({
                        daily_recommendations_enabled: true
                    }).eq('phone', companyPhone);
                    console.log(`[Bootstrap] ✅ Recomendaciones diarias activadas para ${companyPhone}.`);
                } else {
                    console.log(`[Bootstrap] ℹ️  Perfil ${companyPhone} ya tiene recomendaciones diarias activas.`);
                }
            } catch (err) {
                console.warn('[Bootstrap] No se pudo auto-registrar WHATSAPP_COMPANY_PHONE:', err instanceof Error ? err.message : err);
            }
        })();
    }
    // ── Start daily WhatsApp scheduler ────────────────────────────────────
    // Starts whenever YCLOUD_API_KEY is present (no separate YCLOUD_ENABLED flag needed)
    if (process.env.YCLOUD_API_KEY) {
        const scheduler = new _DailySchedulerService.DailySchedulerService(sendDailyToAllUseCase);
        scheduler.start();
    } else {
        console.warn('[Bootstrap] ⚠️  YCLOUD_API_KEY no configurada — el scheduler diario está desactivado.');
    }
}
bootstrap();

//# sourceMappingURL=main.js.map