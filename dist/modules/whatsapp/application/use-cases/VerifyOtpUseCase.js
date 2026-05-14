"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VerifyOtpUseCase", {
    enumerable: true,
    get: function() {
        return VerifyOtpUseCase;
    }
});
const _SendOtpUseCase = require("./SendOtpUseCase");
const _Result = require("../../../../shared/domain/Result");
let VerifyOtpUseCase = class VerifyOtpUseCase {
    async execute(phone, code) {
        const normalized = phone.trim();
        const stored = _SendOtpUseCase.otpStore.get(normalized);
        if (!stored) {
            return _Result.Result.fail('No se encontró un código OTP para este número. Solicita uno nuevo.');
        }
        if (stored.isExpired()) {
            _SendOtpUseCase.otpStore.delete(normalized);
            return _Result.Result.fail('El código ha expirado. Solicita uno nuevo.');
        }
        if (!stored.isValid(code)) {
            // Increment attempts
            const updated = stored.withIncrementedAttempts();
            _SendOtpUseCase.otpStore.set(normalized, updated);
            const remaining = 4 - updated.attempts;
            return _Result.Result.fail(remaining > 0 ? `Código incorrecto. Te quedan ${remaining} intentos.` : 'Demasiados intentos. Solicita un código nuevo.');
        }
        // Successful verification - remove OTP from store
        _SendOtpUseCase.otpStore.delete(normalized);
        return _Result.Result.ok({
            verified: true,
            phone: normalized
        });
    }
};

//# sourceMappingURL=VerifyOtpUseCase.js.map