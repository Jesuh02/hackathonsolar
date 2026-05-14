"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WhatsAppController", {
    enumerable: true,
    get: function() {
        return WhatsAppController;
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
const sendOtpSchema = _zod.z.object({
    phone: _zod.z.string().min(8, 'Número de teléfono requerido')
});
const verifyOtpSchema = _zod.z.object({
    phone: _zod.z.string().min(8, 'Número de teléfono requerido'),
    code: _zod.z.string().length(6, 'El código debe tener 6 dígitos')
});
/** Detect report-generation intent and extract format */ function detectReportIntent(text) {
    // Format keywords alone are sufficient: "mándame un pdf", "realiza un pdf", etc.
    if (/\bpdf\b/i.test(text)) return 'pdf';
    if (/\bexcel\b|\bxls\b|\bxlsx\b/i.test(text)) return 'excel';
    if (/\bword\b|\bdocx\b/i.test(text)) return 'word';
    // Generic report/generate trigger words → default PDF
    if (/(reporte|informe|report|genera|generar|crea|crear|hazme|dame|exporta|exportar|descarga|descargar|archivo|realiza|realizar|histor)/i.test(text)) return 'pdf';
    return null;
}
let WhatsAppController = class WhatsAppController {
    /** POST /api/whatsapp/send-otp */ async handleSendOtp(req, res, next) {
        try {
            const parsed = sendOtpSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Datos inválidos',
                    details: parsed.error.flatten()
                });
                return;
            }
            const result = await this.sendOtp.execute(parsed.data.phone);
            if (result.isFailure) {
                res.status(400).json({
                    error: result.error
                });
                return;
            }
            res.json({
                success: true,
                message: 'Código enviado por WhatsApp. Válido 10 minutos.'
            });
        } catch (error) {
            next(error);
        }
    }
    /** POST /api/whatsapp/verify-otp */ async handleVerifyOtp(req, res, next) {
        try {
            const parsed = verifyOtpSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Datos inválidos',
                    details: parsed.error.flatten()
                });
                return;
            }
            const result = await this.verifyOtp.execute(parsed.data.phone, parsed.data.code);
            if (result.isFailure) {
                res.status(400).json({
                    error: result.error
                });
                return;
            }
            res.json({
                success: true,
                verified: true,
                phone: result.value.phone
            });
        } catch (error) {
            next(error);
        }
    }
    /** GET /api/whatsapp/download/:id — serves a previously generated report file */ async handleDownload(req, res, _next) {
        void req;
        res.status(410).json({
            error: 'Los reportes de WhatsApp ahora se publican directamente en Cloudflare R2.'
        });
    }
    /** POST /api/whatsapp/webhook  – YCloud incoming message callback */ async handleWebhook(req, res, _next) {
        try {
            // YCloud sends a verification GET before activating the webhook
            const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'solar-webhook-token';
            if (req.method === 'GET') {
                if (req.query['hub.verify_token'] === verifyToken) {
                    res.status(200).send(req.query['hub.challenge']);
                } else {
                    res.status(403).send('Forbidden');
                }
                return;
            }
            // Acknowledge immediately so YCloud doesn't retry
            res.status(200).json({
                received: true
            });
            // Process incoming message
            // YCloud payload: { type, whatsappInboundMessage: { ... } }  (no "data" wrapper)
            const event = req.body;
            const type = event?.type ?? '';
            if (type === 'whatsapp.inbound_message.received') {
                const msg = event?.whatsappInboundMessage ?? event?.data?.whatsappInboundMessage;
                const from = msg?.from ?? '';
                const text = msg?.text?.body?.trim() ?? '';
                if (!from || !text) {
                    console.warn('[Webhook] Missing from/text in payload:', JSON.stringify(event));
                    return;
                }
                console.log(`[Webhook] Incoming WhatsApp from ${from}: "${text.slice(0, 80)}"`);
                // 6-digit code → OTP verification
                if (/^\d{6}$/.test(text)) {
                    const result = await this.verifyOtp.execute(from, text);
                    if (result.isSuccess) {
                        await this.whatsApp.sendMessage({
                            to: from,
                            body: '✅ ¡Código verificado correctamente! Ya puedes usar el Agente Solar. 🌞\n\n¿Tienes alguna pregunta sobre energía solar o tu consumo eléctrico?'
                        });
                    } else {
                        await this.whatsApp.sendMessage({
                            to: from,
                            body: '❌ Código inválido o expirado. Por favor solicita un nuevo código.'
                        });
                    }
                    return;
                }
                // Report generation intent → generate file and send download link
                const reportFormat = detectReportIntent(text);
                console.log(`[Webhook] detectReportIntent("${text.slice(0, 60)}") → ${reportFormat ?? 'null (chat)'}`);
                if (reportFormat) {
                    console.log(`[Webhook] Starting ${reportFormat.toUpperCase()} report generation for ${from}`);
                    await this.whatsApp.sendMessage({
                        to: from,
                        body: `📊 Generando tu reporte *${reportFormat.toUpperCase()}* con datos NASA POWER 2019–${new Date().getFullYear()}… Un momento por favor. ⏳`
                    });
                    const today = new Date();
                    const endDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
                    console.log(`[Webhook] Calling GenerateReportUseCase startDate=20190101 endDate=${endDate}`);
                    let reportResult;
                    try {
                        reportResult = await this.generateReport.execute({
                            query: text,
                            format: reportFormat,
                            startDate: '20190101',
                            endDate
                        });
                    } catch (genErr) {
                        const msg = genErr instanceof Error ? genErr.message : String(genErr);
                        console.error('[Webhook] GenerateReportUseCase threw:', msg);
                        await this.whatsApp.sendMessage({
                            to: from,
                            body: `⚠️ Error al generar el reporte: ${msg}`
                        });
                        return;
                    }
                    console.log(`[Webhook] GenerateReportUseCase finished isSuccess=${reportResult.isSuccess}`);
                    if (reportResult.isSuccess) {
                        const { buffer, filename, mimeType } = reportResult.value;
                        console.log(`[Webhook] PDF ready: ${filename} (${buffer.length} bytes), uploading to R2...`);
                        const storageResult = await this.reportStorage.store({
                            buffer,
                            filename,
                            mimeType,
                            phone: from
                        });
                        console.log(`[Webhook] R2 store finished isSuccess=${storageResult.isSuccess}${storageResult.isFailure ? ' error=' + storageResult.error : ''}`);
                        if (storageResult.isFailure) {
                            console.error('[Webhook] Report upload error:', storageResult.error);
                            await this.whatsApp.sendMessage({
                                to: from,
                                body: `⚠️ El reporte fue generado pero falló la subida a R2: ${storageResult.error}`
                            });
                            return;
                        }
                        const { url } = storageResult.value;
                        console.log(`[Webhook] Sending URL to ${from}: ${url}`);
                        await this.whatsApp.sendMessage({
                            to: from,
                            body: `✅ Tu reporte *${reportFormat.toUpperCase()}* está listo:\n\n📎 ${url}`
                        });
                        console.log(`[Webhook] Report flow completed successfully for ${from}`);
                    } else {
                        console.error('[Webhook] Report generation error:', reportResult.error);
                        await this.whatsApp.sendMessage({
                            to: from,
                            body: `⚠️ Error generando el reporte: ${reportResult.error}`
                        });
                    }
                    return;
                }
                // Any other message → LLM chat
                const chatResult = await this.chatWithLlm.execute(from, text);
                const replyBody = chatResult.isSuccess ? chatResult.value : '⚠️ Lo siento, ocurrió un error procesando tu consulta. Por favor intenta de nuevo en un momento.';
                if (chatResult.isFailure) {
                    console.error('[Webhook] Chat error:', chatResult.error);
                }
                const sendResult = await this.whatsApp.sendMessage({
                    to: from,
                    body: replyBody
                });
                if (sendResult.isFailure) {
                    console.error('[Webhook] sendMessage failed:', sendResult.error);
                }
            }
        } catch (error) {
            console.error('[Webhook] Error:', error);
        }
    }
    /** POST /api/whatsapp/send-daily  (manual trigger for testing) */ async handleSendDaily(req, res, next) {
        try {
            const result = await this.sendDailyRec.execute();
            if (result.isFailure) {
                res.status(502).json({
                    error: result.error
                });
                return;
            }
            res.json({
                success: true,
                message: 'Recomendaciones diarias enviadas.'
            });
        } catch (error) {
            next(error);
        }
    }
    /**
   * POST /api/whatsapp/trigger-daily-all
   * Manually triggers the daily WhatsApp recommendations to ALL users in Supabase.
   * Protected by SCHEDULER_SECRET env var (send header X-Scheduler-Secret).
   */ async handleTriggerDailyAll(req, res, next) {
        try {
            const secret = process.env.SCHEDULER_SECRET;
            if (secret) {
                const provided = req.headers['x-scheduler-secret'];
                if (provided !== secret) {
                    res.status(401).json({
                        error: 'No autorizado'
                    });
                    return;
                }
            }
            console.log('[TriggerDailyAll] Manual trigger initiated...');
            const result = await this.sendDailyToAll.execute();
            if (result.isFailure) {
                res.status(502).json({
                    error: result.error
                });
                return;
            }
            res.json({
                success: true,
                message: 'Recomendaciones diarias enviadas a todos los usuarios activos.'
            });
        } catch (error) {
            next(error);
        }
    }
    constructor(sendOtp, verifyOtp, sendDailyRec, chatWithLlm, whatsApp, generateReport, reportStorage, sendDailyToAll){
        _define_property(this, "sendOtp", void 0);
        _define_property(this, "verifyOtp", void 0);
        _define_property(this, "sendDailyRec", void 0);
        _define_property(this, "chatWithLlm", void 0);
        _define_property(this, "whatsApp", void 0);
        _define_property(this, "generateReport", void 0);
        _define_property(this, "reportStorage", void 0);
        _define_property(this, "sendDailyToAll", void 0);
        this.sendOtp = sendOtp;
        this.verifyOtp = verifyOtp;
        this.sendDailyRec = sendDailyRec;
        this.chatWithLlm = chatWithLlm;
        this.whatsApp = whatsApp;
        this.generateReport = generateReport;
        this.reportStorage = reportStorage;
        this.sendDailyToAll = sendDailyToAll;
    }
};

//# sourceMappingURL=whatsapp.controller.js.map