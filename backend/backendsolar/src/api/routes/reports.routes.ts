import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';

export function createReportsRoutes(controller: ReportsController): Router {
  const router = Router();

  router.post('/generate', (req, res, next) => controller.handleGenerate(req, res, next));

  return router;
}
