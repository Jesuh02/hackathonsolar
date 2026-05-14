/**
 * Base ValueObject class - Shared Domain
 * Inmutable por definición - sin identidad, comparado por valor
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ValueObject", {
    enumerable: true,
    get: function() {
        return ValueObject;
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
let ValueObject = class ValueObject {
    equals(other) {
        if (!(other instanceof ValueObject)) return false;
        return JSON.stringify(this.props) === JSON.stringify(other.props);
    }
    getValue() {
        return this.props;
    }
    constructor(props){
        _define_property(this, "props", void 0);
        this.props = Object.freeze({
            ...props
        });
    }
};

//# sourceMappingURL=ValueObject.js.map