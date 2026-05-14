"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createReportsRoutes", {
    enumerable: true,
    get: function() {
        return createReportsRoutes;
    }
});
const _express = require("express");
function createReportsRoutes(controller) {
    const router = (0, _express.Router)();
    router.post('/generate', (req, res, next)=>controller.handleGenerate(req, res, next));
    return router;
}

//# sourceMappingURL=reports.routes.js.map