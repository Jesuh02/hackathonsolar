import { Router } from 'express';
import { RecommendationsController } from '../controllers/recommendations.controller';

export function createRecommendationsRoutes(controller: RecommendationsController): Router {
  const router = Router();

  /**
   * POST /api/recommendations/generate
   * Genera recomendaciones energéticas con el Agente Solar IA
   */
  router.post('/generate', (req, res, next) => controller.generate(req, res, next));

  /**
   * GET /api/recommendations/demo
   * Recomendaciones de demostración para un tipo de negocio
   * Query: type (hotel|hielera|retail)
   */
  router.get('/demo', (req, res, next) => controller.getDemoRecommendation(req, res, next));

  return router;
}
