import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Infrastructure adapters
import { NasaPowerApiAdapter } from './modules/solar/infrastructure/adapters/NasaPowerApiAdapter';
import { SolarDataCacheRepository } from './modules/solar/infrastructure/repositories/SolarDataCacheRepository';
import { OpenRouterLlmAdapter } from './modules/recommendations/infrastructure/adapters/OpenRouterLlmAdapter';
import { YCloudWhatsAppAdapter } from './modules/whatsapp/infrastructure/adapters/YCloudWhatsAppAdapter';
import { ExcelReportAdapter } from './modules/reports/infrastructure/adapters/ExcelReportAdapter';
import { PdfReportAdapter } from './modules/reports/infrastructure/adapters/PdfReportAdapter';
import { WordReportAdapter } from './modules/reports/infrastructure/adapters/WordReportAdapter';
import { CloudflareR2ReportStorageAdapter } from './modules/reports/infrastructure/adapters/CloudflareR2ReportStorageAdapter';

// Application use cases
import { GetSolarRadiationUseCase } from './modules/solar/application/use-cases/GetSolarRadiationUseCase';
import { GenerateRecommendationsUseCase } from './modules/recommendations/application/use-cases/GenerateRecommendationsUseCase';
import { SendOtpUseCase } from './modules/whatsapp/application/use-cases/SendOtpUseCase';
import { VerifyOtpUseCase } from './modules/whatsapp/application/use-cases/VerifyOtpUseCase';
import { SendDailyRecommendationUseCase } from './modules/whatsapp/application/use-cases/SendDailyRecommendationUseCase';
import { SendDailyToAllUsersUseCase } from './modules/whatsapp/application/use-cases/SendDailyToAllUsersUseCase';
import { ChatWithLlmUseCase } from './modules/whatsapp/application/use-cases/ChatWithLlmUseCase';
import { DailySchedulerService } from './modules/whatsapp/application/services/DailySchedulerService';
import { GenerateReportUseCase } from './modules/reports/application/use-cases/GenerateReportUseCase';

// Controllers
import { SolarController } from './api/controllers/solar.controller';
import { RecommendationsController } from './api/controllers/recommendations.controller';
import { WhatsAppController } from './api/controllers/whatsapp.controller';
import { ReportsController } from './api/controllers/reports.controller';
import { CompanyController } from './api/controllers/company.controller';

// Routes
import { createSolarRoutes } from './api/routes/solar.routes';
import { createRecommendationsRoutes } from './api/routes/recommendations.routes';
import { createWhatsAppRoutes } from './api/routes/whatsapp.routes';
import { createReportsRoutes } from './api/routes/reports.routes';
import { createCompanyRoutes } from './api/routes/company.routes';

// Middlewares
import { errorMiddleware } from './api/middlewares/error.middleware';

function bootstrap(): void {
  const app = express();
  const PORT = process.env.PORT ?? 3001;

  // ── CORS ──────────────────────────────────────────────────────────────
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',').map(o => o.trim()) : []),
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow any Railway or Vercel preview URL
      if (/\.up\.railway\.app$/.test(origin) || /\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Infrastructure adapters ────────────────────────────────────────────
  const nasaAdapter = new NasaPowerApiAdapter(
    process.env.NASA_API_BASE_URL ?? 'https://power.larc.nasa.gov/api'
  );

  const solarRepository = new SolarDataCacheRepository(
    parseInt(process.env.CACHE_TTL ?? '3600', 10)
  );

  const llmAdapter = new OpenRouterLlmAdapter(
    process.env.OPENROUTER_API_KEY ?? '',
    process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b',
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
  );

  const whatsAppAdapter = new YCloudWhatsAppAdapter(
    process.env.YCLOUD_API_KEY ?? '',
    process.env.YCLOUD_BASE_URL ?? 'https://api.ycloud.com/v2',
    process.env.YCLOUD_WHATSAPP_NUMBER ?? ''
  );

  const reportStorage = new CloudflareR2ReportStorageAdapter({
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucketName: process.env.R2_BUCKET_NAME ?? '',
    publicUrl: process.env.R2_PUBLIC_URL ?? '',
  });

  // ── Application use cases ──────────────────────────────────────────────
  const getSolarUseCase = new GetSolarRadiationUseCase(solarRepository, nasaAdapter);
  const generateRecommendationsUseCase = new GenerateRecommendationsUseCase(
    llmAdapter,
    solarRepository,
    nasaAdapter
  );

  const sendOtpUseCase = new SendOtpUseCase(whatsAppAdapter);
  const verifyOtpUseCase = new VerifyOtpUseCase();
  const sendDailyRecUseCase = new SendDailyRecommendationUseCase(
    whatsAppAdapter,
    generateRecommendationsUseCase,
    process.env.WHATSAPP_COMPANY_PHONE ?? '',
    nasaAdapter
  );

  const chatWithLlmUseCase = new ChatWithLlmUseCase(
    nasaAdapter,
    process.env.OPENROUTER_API_KEY ?? '',
    process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b',
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
  );

  const sendDailyToAllUseCase = new SendDailyToAllUsersUseCase(
    whatsAppAdapter,
    generateRecommendationsUseCase,
    nasaAdapter
  );

  const generateReportUseCase = new GenerateReportUseCase(
    nasaAdapter,
    {
      excel: new ExcelReportAdapter(),
      pdf: new PdfReportAdapter(),
      word: new WordReportAdapter(),
    },
    process.env.OPENROUTER_API_KEY ?? '',
    process.env.OPENROUTER_MODEL ?? 'qwen/qwen3-235b-a22b',
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
  );

  // ── Controllers ────────────────────────────────────────────────────────
  const solarController = new SolarController(getSolarUseCase);
  const recommendationsController = new RecommendationsController(generateRecommendationsUseCase);
  const whatsAppController = new WhatsAppController(
    sendOtpUseCase,
    verifyOtpUseCase,
    sendDailyRecUseCase,
    chatWithLlmUseCase,
    whatsAppAdapter,
    generateReportUseCase,
    reportStorage,
    sendDailyToAllUseCase,
  );
  const reportsController = new ReportsController(generateReportUseCase);
  const companyController = new CompanyController();

  // ── Routes ─────────────────────────────────────────────────────────────
  app.use('/api/solar', createSolarRoutes(solarController));
  app.use('/api/recommendations', createRecommendationsRoutes(recommendationsController));
  app.use('/api/whatsapp', createWhatsAppRoutes(whatsAppController));
  app.use('/api/reports', createReportsRoutes(reportsController));
  app.use('/api/companies', createCompanyRoutes(companyController));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Agente Solar - Riohacha',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(errorMiddleware);

  const server = app.listen(PORT, () => {
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
    void (async () => {
      try {
        const { getSupabaseClient } = await import('./shared/infrastructure/SupabaseClient');
        const supabase = getSupabaseClient();
        const { data: existing } = await supabase
          .from('business_profiles')
          .select('id, daily_recommendations_enabled')
          .eq('phone', companyPhone)
          .maybeSingle();

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
            daily_recommendations_enabled: true,
          });
          console.log(`[Bootstrap] ✅ Perfil auto-registrado para ${companyPhone} con recomendaciones diarias activas.`);
        } else if (!existing.daily_recommendations_enabled) {
          await supabase
            .from('business_profiles')
            .update({ daily_recommendations_enabled: true })
            .eq('phone', companyPhone);
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
    const scheduler = new DailySchedulerService(sendDailyToAllUseCase);
    scheduler.start();
  } else {
    console.warn('[Bootstrap] ⚠️  YCLOUD_API_KEY no configurada — el scheduler diario está desactivado.');
  }
}

bootstrap();
