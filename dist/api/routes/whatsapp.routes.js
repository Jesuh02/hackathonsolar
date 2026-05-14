"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createWhatsAppRoutes", {
    enumerable: true,
    get: function() {
        return createWhatsAppRoutes;
    }
});
const _express = require("express");
function createWhatsAppRoutes(controller) {
    const router = (0, _express.Router)();
    router.post('/send-otp', (req, res, next)=>controller.handleSendOtp(req, res, next));
    router.post('/verify-otp', (req, res, next)=>controller.handleVerifyOtp(req, res, next));
    router.post('/send-daily', (req, res, next)=>controller.handleSendDaily(req, res, next));
    router.post('/trigger-daily-all', (req, res, next)=>controller.handleTriggerDailyAll(req, res, next));
    // YCloud webhook – POST for incoming messages, GET for verification challenge
    router.get('/webhook', (req, res, next)=>controller.handleWebhook(req, res, next));
    router.post('/webhook', (req, res, next)=>controller.handleWebhook(req, res, next));
    // Temp file download for WhatsApp-generated reports (30 min expiry)
    router.get('/download/:id', (req, res, next)=>controller.handleDownload(req, res, next));
    return router;
}

//# sourceMappingURL=whatsapp.routes.js.map