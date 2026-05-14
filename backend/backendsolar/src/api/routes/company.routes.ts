import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';

export function createCompanyRoutes(controller: CompanyController): Router {
  const router = Router();

  /**
   * GET /api/companies/search?name=XXX&municipio=RIOHACHA&ano=2026
   * Search from datos.gov.co registry AND Supabase saved companies
   */
  router.get('/search', (req, res, next) => controller.searchRegistry(req, res, next));

  /**
   * GET /api/companies/:name/history
   * Get energy consumption history for a saved company
   */
  router.get('/:name/history', (req, res, next) => controller.getHistory(req, res, next));

  /**
   * GET /api/companies/:name
   * Get a previously saved company profile by name
   */
  router.get('/:name', (req, res, next) => controller.getByName(req, res, next));

  /**
   * PUT /api/companies
   * Insert or update (upsert) a company profile + append history snapshot
   */
  router.put('/', (req, res, next) => controller.upsert(req, res, next));

  return router;
}
