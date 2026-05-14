export type BusinessType = 'hotel' | 'hielera' | 'retail' | 'oficina' | 'industrial';
export type Priority = 'critica' | 'alta' | 'media' | 'baja';
export type RecommendationCategory =
  | 'operacional'
  | 'solar'
  | 'baterias'
  | 'demanda'
  | 'eficiencia';

export type ConfidenceLevel = 'alta' | 'media' | 'baja';
export type ImpactType = 'economico' | 'energetico' | 'operativo';

export interface CapexInfo {
  minCop: number;
  maxCop: number;
  paybackMonths: number;
  irr?: number;
  npv?: number;
  lcoe?: number;
}

export interface RecommendationScenarios {
  conservador: string;
  realista: string;
  optimista: string;
}

export interface RecommendationItem {
  priority: Priority;
  category: RecommendationCategory;
  impactType: ImpactType;
  confidenceLevel: ConfidenceLevel;
  title: string;
  description: string;
  assumptions?: string[];
  action: string;
  estimatedImpact: string;
  savingsCopPerMonth?: number;
  savingsCalculationExplanation?: string;
  capex?: CapexInfo;
  scenarios?: RecommendationScenarios;
  benchmark?: string;
  strategicOrder?: number;
  warnings?: string[];
}

export interface SolarContext {
  averageIrradiance: number;
  radiationLevel: string;
  solarPotentialKwhPerDay: number;
  analysedLocation: {
    lat: number;
    lng: number;
    address?: string;
  };
  analysisDatetime?: string;
  solarCondition?: string;
}

export interface RecommendationsResponse {
  id: string;
  businessName: string;
  businessType: BusinessType;
  date: string;
  energyScore: number;
  estimatedMonthlySavingsKwh: number;
  estimatedMonthlySavingsCop: number;
  recommendations: RecommendationItem[];
  generatedAt: string;
  warnings?: string[];
  solarContext: SolarContext;
}

export interface BusinessLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface GenerateRecommendationsRequest {
  businessName: string;
  businessType: BusinessType;
  monthlyConsumptionKwh: number;
  peakDemandKw: number;
  operatingHoursPerDay: number;
  hasSolarPanels: boolean;
  solarCapacityKw?: number;
  hasBatteryStorage: boolean;
  batteryCapacityKwh?: number;
  electricityRateCopPerKwh: number;
  location?: BusinessLocation;
  analysisDatetime?: string; // ISO-8601, e.g. "2026-05-12T14:30"
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  critica: 'bg-red-100 text-red-800 border-red-200',
  alta: 'bg-orange-100 text-orange-800 border-orange-200',
  media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  baja: 'bg-green-100 text-green-800 border-green-200',
};

export const CATEGORY_ICONS: Record<RecommendationCategory, string> = {
  operacional: '⚙️',
  solar: '☀️',
  baterias: '🔋',
  demanda: '📊',
  eficiencia: '💡',
};

export const CONFIDENCE_BADGE: Record<ConfidenceLevel, { label: string; color: string }> = {
  alta:  { label: '🟢 Alta certeza',   color: 'text-green-700 bg-green-50 border-green-200' },
  media: { label: '🟡 Certeza media',  color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  baja:  { label: '🔴 Estimación genérica', color: 'text-red-700 bg-red-50 border-red-200' },
};

export const IMPACT_TYPE_BADGE: Record<ImpactType, { label: string; icon: string }> = {
  economico:   { label: 'Impacto económico',   icon: '💰' },
  energetico:  { label: 'Impacto energético',  icon: '⚡' },
  operativo:   { label: 'Impacto operativo',   icon: '🧯' },
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  hotel: 'Hotel / Hospedaje',
  hielera: 'Hielera / Planta de Hielo',
  retail: 'Retail / Supermercado',
  oficina: 'Oficinas',
  industrial: 'Industrial',
};
