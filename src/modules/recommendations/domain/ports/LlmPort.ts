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
    avgIrradiance: number;        // 30-day average (context only)
    canonicalIrradiance: number;  // = P50, use for ALL financial calculations
    p50Irradiance: number;        // median of full historical series
    historicalMin: number;
    historicalMax: number;
    potentialSolarGenKwhPerDay: number;
    potentialSolarSavingsCopPerMonth: number;
    demandChargeCopPerMonth: number;
    season: string;
    todayIrradiance: number | null;  // context only, NOT for financial calcs
    autoconsumoFactor: number;    // fraction consumed on-site (by business type)
    pr: number;                   // performance ratio used (0.72–0.78)
    lossesFactorCaribe: number;   // 0.85 additional losses for Caribbean climate
    annualKwhPerKwp: number;      // capped at 1800 kWh/kWp/year
    maxSavingsCapKwh: number;
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
