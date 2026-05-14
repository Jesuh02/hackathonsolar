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
  title: string;
  description: string;
  action: string;
  estimatedImpact: string;
  savingsCalculationExplanation?: string;
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
