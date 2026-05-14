import { Request, Response, NextFunction } from 'express';
import { GenerateRecommendationsUseCase } from '../../modules/recommendations/application/use-cases/GenerateRecommendationsUseCase';
import { GenerateRecommendationsRequestDto } from '../../modules/recommendations/application/dtos/RecommendationDto';
import { z } from 'zod';

const recommendationSchema = z.object({
  businessName: z.string().min(2, 'Nombre de empresa requerido'),
  businessType: z.enum(['hotel', 'hielera', 'retail', 'oficina', 'industrial']),
  monthlyConsumptionKwh: z.number().positive('El consumo debe ser positivo'),
  peakDemandKw: z.number().positive('La demanda pico debe ser positiva'),
  operatingHoursPerDay: z.number().min(1).max(24),
  hasSolarPanels: z.boolean(),
  solarCapacityKw: z.number().positive().optional(),
  hasBatteryStorage: z.boolean(),
  batteryCapacityKwh: z.number().positive().optional(),
  electricityRateCopPerKwh: z.number().positive().default(750),
  startDate: z.string().regex(/^\d{8}$/).optional(),
  endDate: z.string().regex(/^\d{8}$/).optional(),
  location: z.object({
    lat: z.number().min(11.500).max(11.580),
    lng: z.number().min(-72.960).max(-72.850),
    address: z.string().optional(),
  }).optional(),
  analysisDatetime: z.string().optional(), // ISO-8601 local datetime
});

/**
 * Controlador de Recomendaciones - Adaptador primario HTTP
 */
export class RecommendationsController {
  constructor(
    private readonly generateRecommendationsUseCase: GenerateRecommendationsUseCase
  ) {}

  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = recommendationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Datos de empresa inválidos', details: parsed.error.flatten() });
        return;
      }

      const result = await this.generateRecommendationsUseCase.execute(
        parsed.data as GenerateRecommendationsRequestDto
      );

      if (result.isFailure) {
        res.status(502).json({ error: result.error });
        return;
      }

      res.json(result.value);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Perfil demo de un hotel en Riohacha para pruebas rápidas
   */
  async getDemoRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessType = (req.query.type as string) ?? 'hotel';
      const demoProfiles: Record<string, object> = {
        hotel: {
          businessName: 'Hotel Almirante Padilla',
          businessType: 'hotel',
          monthlyConsumptionKwh: 15000,
          peakDemandKw: 45,
          operatingHoursPerDay: 24,
          hasSolarPanels: false,
          hasBatteryStorage: false,
          electricityRateCopPerKwh: 780,
        },
        hielera: {
          businessName: 'Hielera El Caribe',
          businessType: 'hielera',
          monthlyConsumptionKwh: 8000,
          peakDemandKw: 30,
          operatingHoursPerDay: 16,
          hasSolarPanels: true,
          solarCapacityKw: 10,
          hasBatteryStorage: false,
          electricityRateCopPerKwh: 750,
        },
        retail: {
          businessName: 'Supermercado La Guajira',
          businessType: 'retail',
          monthlyConsumptionKwh: 5000,
          peakDemandKw: 20,
          operatingHoursPerDay: 12,
          hasSolarPanels: false,
          hasBatteryStorage: false,
          electricityRateCopPerKwh: 760,
        },
      };

      const profile = demoProfiles[businessType] ?? demoProfiles.hotel;
      const parsed = recommendationSchema.safeParse(profile);

      if (!parsed.success) {
        res.status(500).json({ error: 'Perfil demo inválido' });
        return;
      }

      const result = await this.generateRecommendationsUseCase.execute(
        parsed.data as GenerateRecommendationsRequestDto
      );

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
