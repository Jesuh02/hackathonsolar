"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get SendOtpUseCase () {
        return SendOtpUseCase;
    },
    get otpStore () {
        return otpStore;
    }
});
const _OtpCode = require("../../domain/entities/OtpCode");
const _Result = require("../../../../shared/domain/Result");
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
/**
 * In-memory OTP store (sufficient for stateless single-instance deployments)
 * key = phone number (E.164)
 */ const otpStore = new Map();
let SendOtpUseCase = class SendOtpUseCase {
    async execute(phone) {
        const normalized = this.normalizePhone(phone);
        if (!normalized) {
            return _Result.Result.fail('Número de teléfono inválido. Usa formato internacional, ej: +573001234567');
        }
        const otp = _OtpCode.OtpCode.create(normalized, 600); // 10 minutes TTL
        otpStore.set(normalized, otp);
        const result = await this.whatsApp.sendOtp({
            to: normalized,
            code: otp.code
        });
        if (result.isFailure) {
            otpStore.delete(normalized);
            return _Result.Result.fail(result.error);
        }
        return _Result.Result.ok(undefined);
    }
    normalizePhone(phone) {
        const cleaned = phone.replace(/\s/g, '');
        // Must start with + and have 7-15 digits
        if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
        return null;
    }
    constructor(whatsApp){
        _define_property(this, "whatsApp", void 0);
        this.whatsApp = whatsApp;
    }
};

//# sourceMappingURL=SendOtpUseCase.js.map