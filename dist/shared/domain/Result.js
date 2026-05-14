/**
 * Result pattern - manejo funcional de errores sin excepciones
 * Principio: Open/Closed - extensible sin modificar
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Result", {
    enumerable: true,
    get: function() {
        return Result;
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
let Result = class Result {
    get isSuccess() {
        return this._isSuccess;
    }
    get isFailure() {
        return !this._isSuccess;
    }
    get error() {
        if (this._isSuccess) throw new Error('No error on success result');
        return this._error;
    }
    get value() {
        if (!this._isSuccess) throw new Error('No value on failure result');
        return this._value;
    }
    static ok(value) {
        return new Result(true, null, value);
    }
    static fail(error) {
        return new Result(false, error, null);
    }
    constructor(isSuccess, error, value){
        _define_property(this, "_isSuccess", void 0);
        _define_property(this, "_error", void 0);
        _define_property(this, "_value", void 0);
        this._isSuccess = isSuccess;
        this._error = error;
        this._value = value;
    }
};

//# sourceMappingURL=Result.js.map