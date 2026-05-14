import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Infrastructure adapters
import { NasaPowerApiAdapter } from './modules/solar/infrastructure/adapters/NasaPowerApiAdapter';
import { SolarDataCacheRepository } from './modules/solar/infrastructure/repositories/SolarDataCacheRepository';
import { OpenRouterLlmAdapter } from './modules/recommendations/infrastructure/adapters/OpenRouterLlmAdapter';

// Application use cases
import { GetSolarRadiationUseCase } from './modules/solar/application/use-cases/GetSolarRadiationUseCase';
import { GenerateRecommendationsUseCase } from './modules/recommendations/application/use-cases/GenerateRecommendationsUseCase';

// Controllers
import { SolarController } from './api/controllers/solar.controller';
import { RecommendationsController } from './api/controllers/recommendations.controller';

// Routes
import { createSolarRoutes } from './api/routes/solar.routes';
import { createRecommendationsRoutes } from './api/routes/recommendations.routes';

// Middlewares
import { errorMiddleware } from './api/middlewares/error.middleware';

/**
 * Composición de dependencias (Dependency Injection manual)
 * Principio: Dependency Inversion - las dependencias fluyen desde afuera hacia adentro
 */
function bootstrap(): void {
  const app = express();
  const PORT = process.env.PORT ?? 3001;

  // Middlewares globales
  app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Inicializar adaptadores de infraestructura
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

  // Inicializar casos de uso
  const getSolarUseCase = new GetSolarRadiationUseCase(solarRepository, nasaAdapter);
  const generateRecommendationsUseCase = new GenerateRecommendationsUseCase(
    llmAdapter,
    solarRepository,
    nasaAdapter
  );

  // Inicializar controladores
  const solarController = new SolarController(getSolarUseCase);
  const recommendationsController = new RecommendationsController(generateRecommendationsUseCase);

  // Registrar rutas
  app.use('/api/solar', createSolarRoutes(solarController));
  app.use('/api/recommendations', createRecommendationsRoutes(recommendationsController));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Agente Solar - Riohacha',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Manejador de errores (siempre al final)
  app.use(errorMiddleware);

  const server = app.listen(PORT, () => {
    console.log(`🌞 Agente Solar Backend corriendo en http://localhost:${PORT}`);
    console.log(`📡 NASA POWER API: ${process.env.NASA_API_BASE_URL}`);
    console.log(`🤖 LLM Model: ${process.env.OPENROUTER_MODEL}`);
  });

  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;
}

bootstrap();
