export interface SolarDataPoint {
  id: string;
  date: string;
  irradiance: number;
  radiationLevel: 'baja' | 'media' | 'alta' | 'excelente';
  estimatedPanelOutput: number;
  latitude: number;
  longitude: number;
  location: string;
}

export interface SolarStats {
  total: number;
  average: number;
  max: number;
  min: number;
  period: {
    start: string;
    end: string;
  };
}

export interface SolarLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface SolarRadiationResponse {
  data: SolarDataPoint[];
  stats: SolarStats;
  location: SolarLocation;
}

export interface MonthlyAggregate {
  month: string;
  monthLabel: string;
  avgIrradiance: number;
  totalIrradiance: number;
  maxIrradiance: number;
  minIrradiance: number;
  daysCount: number;
}

export type RadiationLevel = 'baja' | 'media' | 'alta' | 'excelente';

export const RADIATION_COLORS: Record<RadiationLevel, string> = {
  baja: '#ef4444',
  media: '#f97316',
  alta: '#eab308',
  excelente: '#22c55e',
};

export const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};
