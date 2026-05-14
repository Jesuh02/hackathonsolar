"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "YCloudWhatsAppAdapter", {
    enumerable: true,
    get: function() {
        return YCloudWhatsAppAdapter;
    }
});
const _Result = require("../../../../shared/domain/Result");
const _HttpClient = require("../../../../shared/infrastructure/HttpClient");
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
let YCloudWhatsAppAdapter = class YCloudWhatsAppAdapter {
    async sendMessage(options) {
        try {
            await this.httpClient.post('/whatsapp/messages', {
                from: this.senderPhone,
                to: options.to,
                type: 'text',
                text: {
                    body: options.body
                }
            });
            return _Result.Result.ok(undefined);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[YCloudWhatsAppAdapter] sendMessage error:', msg);
            return _Result.Result.fail(`WhatsApp send failed: ${msg}`);
        }
    }
    async sendOtp(options) {
        const body = `🔐 *Agente Solar – Código de verificación*\n\n` + `Tu código es: *${options.code}*\n\n` + `Válido por 10 minutos. No lo compartas con nadie.`;
        return this.sendMessage({
            to: options.to,
            body
        });
    }
    constructor(apiKey, baseUrl, senderPhone){
        _define_property(this, "httpClient", void 0);
        _define_property(this, "senderPhone", void 0); // E.164 without +, e.g. "573044271932"
        this.httpClient = new _HttpClient.HttpClient(baseUrl);
        this.httpClient.setHeader('X-API-Key', apiKey);
        // Strip leading + if present
        this.senderPhone = senderPhone.replace(/^\+/, '');
    }
};

//# sourceMappingURL=YCloudWhatsAppAdapter.js.map