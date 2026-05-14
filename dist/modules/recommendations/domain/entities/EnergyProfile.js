"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EnergyProfile", {
    enumerable: true,
    get: function() {
        return EnergyProfile;
    }
});
const _ValueObject = require("../../../../shared/domain/ValueObject");
let EnergyProfile = class EnergyProfile extends _ValueObject.ValueObject {
    validate(props) {
        if (props.monthlyConsumptionKwh <= 0) throw new Error('El consumo mensual debe ser positivo');
        if (props.peakDemandKw <= 0) throw new Error('La demanda pico debe ser positiva');
        if (props.operatingHoursPerDay < 1 || props.operatingHoursPerDay > 24) throw new Error('Las horas de operación deben estar entre 1 y 24');
    }
    get businessType() {
        return this.props.businessType;
    }
    get businessName() {
        return this.props.businessName;
    }
    get monthlyConsumptionKwh() {
        return this.props.monthlyConsumptionKwh;
    }
    get peakDemandKw() {
        return this.props.peakDemandKw;
    }
    get operatingHoursPerDay() {
        return this.props.operatingHoursPerDay;
    }
    get hasSolarPanels() {
        return this.props.hasSolarPanels;
    }
    get solarCapacityKw() {
        return this.props.solarCapacityKw;
    }
    get hasBatteryStorage() {
        return this.props.hasBatteryStorage;
    }
    get batteryCapacityKwh() {
        return this.props.batteryCapacityKwh;
    }
    get electricityRateCopPerKwh() {
        return this.props.electricityRateCopPerKwh;
    }
    calculateMonthlyCostCop() {
        return this.props.monthlyConsumptionKwh * this.props.electricityRateCopPerKwh;
    }
    calculateAnnualCostCop() {
        return this.calculateMonthlyCostCop() * 12;
    }
    toSummaryString() {
        return [
            `Empresa: ${this.props.businessName} (${this.props.businessType})`,
            `Consumo mensual: ${this.props.monthlyConsumptionKwh} kWh`,
            `Demanda pico: ${this.props.peakDemandKw} kW`,
            `Horas operación/día: ${this.props.operatingHoursPerDay}h`,
            `Paneles solares: ${this.props.hasSolarPanels ? `Sí (${this.props.solarCapacityKw} kW)` : 'No'}`,
            `Baterías: ${this.props.hasBatteryStorage ? `Sí (${this.props.batteryCapacityKwh} kWh)` : 'No'}`,
            `Tarifa: ${this.props.electricityRateCopPerKwh} COP/kWh`,
            `Costo mensual: ${this.calculateMonthlyCostCop().toLocaleString('es-CO')} COP`
        ].join('\n');
    }
    constructor(props){
        super(props);
        this.validate(props);
    }
};

//# sourceMappingURL=EnergyProfile.js.map