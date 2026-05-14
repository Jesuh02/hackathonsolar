import { BusinessType } from '../../domain/entities/Recommendation';

export interface GenerateRecommendationsRequestDto {
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
  startDate?: string;
  endDate?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  analysisDatetime?: string; // ISO-8601 local datetime, e.g. "2026-05-12T14:30"
}

export interface RecommendationItemDto {
  priority: string;
  category: string;
  impactType: string;
  confidenceLevel: string;
  title: string;
  description: string;
  assumptions?: string[];
  action: string;
  estimatedImpact: string;
  savingsCopPerMonth: number;
  savingsCalculationExplanation?: string;
  capex?: {
    minCop: number;
    maxCop: number;
    paybackMonths: number;
    irr?: number;
    npv?: number;
    lcoe?: number;
  };
  scenarios?: {
    conservador: string;
    realista: string;
    optimista: string;
  };
  benchmark?: string;
  strategicOrder?: number;
  warnings?: string[];
}

export interface RecommendationsResponseDto {
  id: string;
  businessName: string;
  businessType: string;
  date: string;
  energyScore: number;
  estimatedMonthlySavingsKwh: number;
  estimatedMonthlySavingsCop: number;
  recommendations: RecommendationItemDto[];
  generatedAt: string;
  warnings?: string[];
  solarContext: {
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
  };
}
