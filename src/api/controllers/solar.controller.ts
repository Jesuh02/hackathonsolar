import { Request, Response, NextFunction } from 'express';
import { GetSolarRadiationUseCase } from '../../modules/solar/application/use-cases/GetSolarRadiationUseCase';
import { z } from 'zod';

const querySchema = z.object({
  startDate: z.string().regex(/^\d{8}$/, 'startDate debe ser YYYYMMDD').default('20230101'),
  endDate: z.string().regex(/^\d{8}$/, 'endDate debe ser YYYYMMDD').default('20231231'),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

/**
 * Controlador Solar - Capa de infraestructura HTTP (adaptador primario)
 */
export class SolarController {
  constructor(private readonly getSolarRadiationUseCase: GetSolarRadiationUseCase) {}

  async getRadiationData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Parámetros inválidos', details: parsed.error.flatten() });
        return;
      }

      const result = await this.getSolarRadiationUseCase.execute(parsed.data);

      if (result.isFailure) {
        res.status(502).json({ error: result.error });
        return;
      }

      res.json(result.value);
    } catch (error) {
      next(error);
    }
  }

  async getAnnualStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = parseInt(req.params.year ?? '2023', 10);
      if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
        res.status(400).json({ error: 'Año inválido' });
        return;
      }

      const result = await this.getSolarRadiationUseCase.execute({
        startDate: `${year}0101`,
        endDate: `${year}1231`,
      });

      if (result.isFailure) {
        res.status(502).json({ error: result.error });
        return;
      }

      res.json(result.value);
    } catch (error) {
      next(error);
    }
  }
}
