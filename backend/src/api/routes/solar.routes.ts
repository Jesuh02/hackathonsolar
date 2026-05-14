import { Router } from 'express';
import { SolarController } from '../controllers/solar.controller';

export function createSolarRoutes(controller: SolarController): Router {
  const router = Router();

  /**
   * GET /api/solar/radiation
   * Obtiene datos de radiación solar por rango de fechas
   * Query: startDate (YYYYMMDD), endDate (YYYYMMDD), latitude?, longitude?
   */
  router.get('/radiation', (req, res, next) => controller.getRadiationData(req, res, next));

  /**
   * GET /api/solar/stats/:year
   * Estadísticas anuales de radiación solar
   */
  router.get('/stats/:year', (req, res, next) => controller.getAnnualStats(req, res, next));

  return router;
}
