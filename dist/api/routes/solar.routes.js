"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createSolarRoutes", {
    enumerable: true,
    get: function() {
        return createSolarRoutes;
    }
});
const _express = require("express");
function createSolarRoutes(controller) {
    const router = (0, _express.Router)();
    /**
   * GET /api/solar/radiation
   * Obtiene datos de radiación solar por rango de fechas
   * Query: startDate (YYYYMMDD), endDate (YYYYMMDD), latitude?, longitude?
   */ router.get('/radiation', (req, res, next)=>controller.getRadiationData(req, res, next));
    /**
   * GET /api/solar/stats/:year
   * Estadísticas anuales de radiación solar
   */ router.get('/stats/:year', (req, res, next)=>controller.getAnnualStats(req, res, next));
    return router;
}

//# sourceMappingURL=solar.routes.js.map