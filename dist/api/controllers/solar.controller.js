"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SolarController", {
    enumerable: true,
    get: function() {
        return SolarController;
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
const querySchema = _zod.z.object({
    startDate: _zod.z.string().regex(/^\d{8}$/, 'startDate debe ser YYYYMMDD').default('20230101'),
    endDate: _zod.z.string().regex(/^\d{8}$/, 'endDate debe ser YYYYMMDD').default('20231231'),
    latitude: _zod.z.coerce.number().optional(),
    longitude: _zod.z.coerce.number().optional()
});
let SolarController = class SolarController {
    async getRadiationData(req, res, next) {
        try {
            const parsed = querySchema.safeParse(req.query);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Parámetros inválidos',
                    details: parsed.error.flatten()
                });
                return;
            }
            const result = await this.getSolarRadiationUseCase.execute(parsed.data);
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
    async getAnnualStats(req, res, next) {
        try {
            const year = parseInt(req.params.year ?? '2023', 10);
            if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
                res.status(400).json({
                    error: 'Año inválido'
                });
                return;
            }
            const result = await this.getSolarRadiationUseCase.execute({
                startDate: `${year}0101`,
                endDate: `${year}1231`
            });
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
    constructor(getSolarRadiationUseCase){
        _define_property(this, "getSolarRadiationUseCase", void 0);
        this.getSolarRadiationUseCase = getSolarRadiationUseCase;
    }
};

//# sourceMappingURL=solar.controller.js.map