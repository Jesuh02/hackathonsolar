"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createRecommendationsRoutes", {
    enumerable: true,
    get: function() {
        return createRecommendationsRoutes;
    }
});
const _express = require("express");
function createRecommendationsRoutes(controller) {
    const router = (0, _express.Router)();
    /**
   * POST /api/recommendations/generate
   * Genera recomendaciones energéticas con el Agente Solar IA
   */ router.post('/generate', (req, res, next)=>controller.generate(req, res, next));
    /**
   * GET /api/recommendations/demo
   * Recomendaciones de demostración para un tipo de negocio
   * Query: type (hotel|hielera|retail)
   */ router.get('/demo', (req, res, next)=>controller.getDemoRecommendation(req, res, next));
    return router;
}

//# sourceMappingURL=recommendations.routes.js.map