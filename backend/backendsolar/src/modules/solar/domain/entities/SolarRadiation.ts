import { Entity } from '@shared/domain/Entity';

export interface SolarRadiationProps {
  date: string;          // Formato YYYYMMDD
  irradiance: number;    // kWh/m²/day - radiación solar global horizontal
  latitude: number;
  longitude: number;
  location: string;
}

/**
 * Entidad del dominio: Dato de Radiación Solar
 * Representa un punto de medición diario de irradiancia solar
 */
export class SolarRadiation extends Entity<string> {
  private readonly props: SolarRadiationProps;

  private constructor(id: string, props: SolarRadiationProps) {
    super(id);
    this.props = props;
  }

  static create(props: SolarRadiationProps): SolarRadiation {
    const id = `${props.date}-${props.latitude}-${props.longitude}`;
    return new SolarRadiation(id, props);
  }

  get date(): string { return this.props.date; }
  get irradiance(): number { return this.props.irradiance; }
  get latitude(): number { return this.props.latitude; }
  get longitude(): number { return this.props.longitude; }
  get location(): string { return this.props.location; }

  /**
   * Clasifica el nivel de radiación para toma de decisiones energéticas
   */
  getRadiationLevel(): 'baja' | 'media' | 'alta' | 'excelente' {
    if (this.props.irradiance < 3) return 'baja';
    if (this.props.irradiance < 4.5) return 'media';
    if (this.props.irradiance < 6) return 'alta';
    return 'excelente';
  }

  /**
   * Potencia estimada generada por panel de 400W (kWh/día)
   */
  estimatePanelOutput(panelWatts = 400, efficiencyFactor = 0.8): number {
    return (panelWatts / 1000) * this.props.irradiance * efficiencyFactor;
  }

  toJSON(): SolarRadiationProps & { id: string; radiationLevel: string } {
    return {
      id: this.id,
      ...this.props,
      radiationLevel: this.getRadiationLevel(),
    };
  }
}
