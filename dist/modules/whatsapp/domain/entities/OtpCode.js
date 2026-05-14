/**
 * OtpCode entity - represents a one-time password with expiration
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OtpCode", {
    enumerable: true,
    get: function() {
        return OtpCode;
    }
});
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
let OtpCode = class OtpCode {
    static create(phone, ttlSeconds = 600) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
        return new OtpCode(phone, code, expiresAt);
    }
    isExpired() {
        return new Date() > this.expiresAt;
    }
    isValid(inputCode) {
        return !this.isExpired() && this.code === inputCode && this.attempts < 5;
    }
    withIncrementedAttempts() {
        return new OtpCode(this.phone, this.code, this.expiresAt, this.attempts + 1);
    }
    constructor(phone, code, expiresAt, attempts = 0){
        _define_property(this, "phone", void 0);
        _define_property(this, "code", void 0);
        _define_property(this, "expiresAt", void 0);
        _define_property(this, "attempts", void 0);
        this.phone = phone;
        this.code = code;
        this.expiresAt = expiresAt;
        this.attempts = attempts;
    }
};

//# sourceMappingURL=OtpCode.js.map