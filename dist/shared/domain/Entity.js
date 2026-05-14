/**
 * Base Entity class - Shared Domain
 * Principio: Single Responsibility - solo maneja identidad de entidades
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Entity", {
    enumerable: true,
    get: function() {
        return Entity;
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
let Entity = class Entity {
    get id() {
        return this._id;
    }
    equals(other) {
        if (!(other instanceof Entity)) return false;
        return this._id === other._id;
    }
    constructor(id){
        _define_property(this, "_id", void 0);
        this._id = id;
    }
};

//# sourceMappingURL=Entity.js.map