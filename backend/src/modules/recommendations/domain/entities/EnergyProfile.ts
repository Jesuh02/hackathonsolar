import { ValueObject } from '@shared/domain/ValueObject';
import { BusinessType } from '../entities/Recommendation';

export interface EnergyProfileProps {
  businessType: BusinessType;
  businessName: string;
  monthlyConsumptionKwh: number;      // Consumo mensual promedio
  peakDemandKw: number;               // Demanda máxima registrada
  operatingHoursPerDay: number;       // Horas de operación diaria
  hasSolarPanels: boolean;
  solarCapacityKw?: number;
  hasBatteryStorage: boolean;
  batteryCapacityKwh?: number;
  electricityRateCopPerKwh: number;   // Tarifa eléctrica COP/kWh
}

/**
 * Value Object: Perfil de consumo energético del negocio
 * Inmutable - describe el estado energético actual
 */
export class EnergyProfile extends ValueObject<EnergyProfileProps> {
  constructor(props: EnergyProfileProps) {
    super(props);
    this.validate(props);
  }

  private validate(props: EnergyProfileProps): void {
    if (props.monthlyConsumptionKwh <= 0)
      throw new Error('El consumo mensual debe ser positivo');
    if (props.peakDemandKw <= 0)
      throw new Error('La demanda pico debe ser positiva');
    if (props.operatingHoursPerDay < 1 || props.operatingHoursPerDay > 24)
      throw new Error('Las horas de operación deben estar entre 1 y 24');
  }

  get businessType(): BusinessType { return this.props.businessType; }
  get businessName(): string { return this.props.businessName; }
  get monthlyConsumptionKwh(): number { return this.props.monthlyConsumptionKwh; }
  get peakDemandKw(): number { return this.props.peakDemandKw; }
  get operatingHoursPerDay(): number { return this.props.operatingHoursPerDay; }
  get hasSolarPanels(): boolean { return this.props.hasSolarPanels; }
  get solarCapacityKw(): number | undefined { return this.props.solarCapacityKw; }
  get hasBatteryStorage(): boolean { return this.props.hasBatteryStorage; }
  get batteryCapacityKwh(): number | undefined { return this.props.batteryCapacityKwh; }
  get electricityRateCopPerKwh(): number { return this.props.electricityRateCopPerKwh; }

  calculateMonthlyCostCop(): number {
    return this.props.monthlyConsumptionKwh * this.props.electricityRateCopPerKwh;
  }

  calculateAnnualCostCop(): number {
    return this.calculateMonthlyCostCop() * 12;
  }

  toSummaryString(): string {
    return [
      `Empresa: ${this.props.businessName} (${this.props.businessType})`,
      `Consumo mensual: ${this.props.monthlyConsumptionKwh} kWh`,
      `Demanda pico: ${this.props.peakDemandKw} kW`,
      `Horas operación/día: ${this.props.operatingHoursPerDay}h`,
      `Paneles solares: ${this.props.hasSolarPanels ? `Sí (${this.props.solarCapacityKw} kW)` : 'No'}`,
      `Baterías: ${this.props.hasBatteryStorage ? `Sí (${this.props.batteryCapacityKwh} kWh)` : 'No'}`,
      `Tarifa: ${this.props.electricityRateCopPerKwh} COP/kWh`,
      `Costo mensual: ${this.calculateMonthlyCostCop().toLocaleString('es-CO')} COP`,
    ].join('\n');
  }
}
