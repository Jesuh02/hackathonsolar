"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SolarRadiation", {
    enumerable: true,
    get: function() {
        return SolarRadiation;
    }
});
const _Entity = require("../../../../shared/domain/Entity");
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
let SolarRadiation = class SolarRadiation extends _Entity.Entity {
    static create(props) {
        const id = `${props.date}-${props.latitude}-${props.longitude}`;
        return new SolarRadiation(id, props);
    }
    get date() {
        return this.props.date;
    }
    get irradiance() {
        return this.props.irradiance;
    }
    get latitude() {
        return this.props.latitude;
    }
    get longitude() {
        return this.props.longitude;
    }
    get location() {
        return this.props.location;
    }
    /**
   * Clasifica el nivel de radiación para toma de decisiones energéticas
   */ getRadiationLevel() {
        if (this.props.irradiance < 3) return 'baja';
        if (this.props.irradiance < 4.5) return 'media';
        if (this.props.irradiance < 6) return 'alta';
        return 'excelente';
    }
    /**
   * Potencia estimada generada por panel de 400W (kWh/día)
   */ estimatePanelOutput(panelWatts = 400, efficiencyFactor = 0.8) {
        return panelWatts / 1000 * this.props.irradiance * efficiencyFactor;
    }
    toJSON() {
        return {
            id: this.id,
            ...this.props,
            radiationLevel: this.getRadiationLevel()
        };
    }
    constructor(id, props){
        super(id), _define_property(this, "props", void 0);
        this.props = props;
    }
};

//# sourceMappingURL=SolarRadiation.js.map