"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RecommendationsController", {
    enumerable: true,
    get: function() {
        return RecommendationsController;
    }
});
const _zod = require("zod");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
const recommendationSchema = _zod.z.object({
    businessName: _zod.z.string().min(2, 'Nombre de empresa requerido'),
    businessType: _zod.z.enum([
        'hotel',
        'hielera',
        'retail',
        'oficina',
        'industrial'
    ]),
    monthlyConsumptionKwh: _zod.z.number().positive('El consumo debe ser positivo'),
    peakDemandKw: _zod.z.number().positive('La demanda pico debe ser positiva'),
    operatingHoursPerDay: _zod.z.number().min(1).max(24),
    hasSolarPanels: _zod.z.boolean(),
    solarCapacityKw: _zod.z.number().positive().optional(),
    hasBatteryStorage: _zod.z.boolean(),
    batteryCapacityKwh: _zod.z.number().positive().optional(),
    electricityRateCopPerKwh: _zod.z.number().positive().default(750),
    startDate: _zod.z.string().regex(/^\d{8}$/).optional(),
    endDate: _zod.z.string().regex(/^\d{8}$/).optional(),
    location: _zod.z.object({
        lat: _zod.z.number().min(-5).max(15),
        lng: _zod.z.number().min(-82).max(-66),
        address: _zod.z.string().optional()
    }).optional(),
    analysisDatetime: _zod.z.string().optional()
});
let RecommendationsController = class RecommendationsController {
    async generate(req, res, next) {
        try {
            const parsed = recommendationSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Datos de empresa inválidos',
                    details: parsed.error.flatten()
                });
                return;
            }
            const result = await this.generateRecommendationsUseCase.execute(parsed.data);
            if (result.isFailure) {
                res.status(502).json({
                    error: result.error
                });
                return;
            }
            res.json(result.value);
        } catch (error) {
            next(error);
        }
    }
    /**
   * Perfil demo de un hotel en Riohacha para pruebas rápidas
   */ async getDemoRecommendation(req, res, next) {
        try {
            const businessType = req.query.type ?? 'hotel';
            const demoProfiles = {
                hotel: {
                    businessName: 'Hotel Almirante Padilla',
                    businessType: 'hotel',
                    monthlyConsumptionKwh: 15000,
                    peakDemandKw: 45,
                    operatingHoursPerDay: 24,
                    hasSolarPanels: false,
                    hasBatteryStorage: false,
                    electricityRateCopPerKwh: 780
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
                    electricityRateCopPerKwh: 750
                },
                retail: {
                    businessName: 'Supermercado La Guajira',
                    businessType: 'retail',
                    monthlyConsumptionKwh: 5000,
                    peakDemandKw: 20,
                    operatingHoursPerDay: 12,
                    hasSolarPanels: false,
                    hasBatteryStorage: false,
                    electricityRateCopPerKwh: 760
                }
            };
            const profile = demoProfiles[businessType] ?? demoProfiles.hotel;
            const parsed = recommendationSchema.safeParse(profile);
            if (!parsed.success) {
                res.status(500).json({
                    error: 'Perfil demo inválido'
                });
                return;
            }
            const result = await this.generateRecommendationsUseCase.execute(parsed.data);
            if (result.isFailure) {
                res.status(502).json({
                    error: result.error
                });
                return;
            }
            res.json(result.value);
        } catch (error) {
            next(error);
        }
    }
    constructor(generateRecommendationsUseCase){
        _define_property(this, "generateRecommendationsUseCase", void 0);
        this.generateRecommendationsUseCase = generateRecommendationsUseCase;
    }
};

//# sourceMappingURL=recommendations.controller.js.map