import { Recommendation } from '../entities/Recommendation';
import { EnergyProfile } from '../entities/EnergyProfile';
import { Result } from '@shared/domain/Result';

export interface LlmRecommendationRequest {
  solarDataSummary: string;
  rawDailyData: Array<{ date: string; irradiance: number }>;
  energyProfile: EnergyProfile;
  currentDate: string;
  location: string;
  analysisHour: number;       // 0-23
  solarCondition: string;
  datetimeLabel: string;
  preComputedFinancials: {
    monthlyBillCop: number;
    dailyConsumptionKwh: number;
    avgIrradiance: number;
    potentialSolarGenKwhPerDay: number;
    potentialSolarSavingsCopPerMonth: number;
    demandChargeCopPerMonth: number;
    season: string;
  };
}

/**
 * Puerto para el servicio LLM - Principio Interface Segregation
 * Solo expone lo necesario para generar recomendaciones
 */
export interface LlmPort {
  generateEnergyRecommendations(
    request: LlmRecommendationRequest
  ): Promise<Result<Recommendation>>;
}
