import { LlmPort } from '../../domain/ports/LlmPort';
import { EnergyProfile } from '../../domain/entities/EnergyProfile';
import { SolarDataRepositoryPort } from '../../../solar/domain/ports/SolarDataRepositoryPort';
import { NasaPowerApiPort } from '../../../solar/domain/ports/NasaPowerApiPort';
import { Result } from '@shared/domain/Result';
import {
  GenerateRecommendationsRequestDto,
  RecommendationsResponseDto,
} from '../dtos/RecommendationDto';

/**
 * Caso de uso: Generar recomendaciones energéticas con IA
 * Orquesta los datos solares y el perfil de la empresa para el agente LLM
 */
export class GenerateRecommendationsUseCase {
  constructor(
    private readonly llmPort: LlmPort,
    private readonly solarRepository: SolarDataRepositoryPort,
    private readonly nasaApi: NasaPowerApiPort
  ) {}

  async execute(
    request: GenerateRecommendationsRequestDto
  ): Promise<Result<RecommendationsResponseDto>> {
    // ── Parse analysis datetime (default = now in Colombia UTC-5) ──────────
    let analysisDate: Date;
    if (request.analysisDatetime) {
      // Input is local Colombia time (no timezone suffix), interpret as-is
      analysisDate = new Date(request.analysisDatetime);
    } else {
      analysisDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    }

    const analysisHour = analysisDate.getHours();
    const analysisDateStr = this.formatDate(analysisDate);

    // For solar data: fetch the specific analysis day + a 30-day window before it for context
    const windowStart = new Date(analysisDate);
    windowStart.setDate(windowStart.getDate() - 30);
    const startDate = request.startDate ?? this.formatDate(windowStart);
    const endDate = request.endDate ?? analysisDateStr;

    // ── Build energy profile ───────────────────────────────────────────────
    const energyProfile = new EnergyProfile({
      businessType: request.businessType,
      businessName: request.businessName,
      monthlyConsumptionKwh: request.monthlyConsumptionKwh,
      peakDemandKw: request.peakDemandKw,
      operatingHoursPerDay: request.operatingHoursPerDay,
      hasSolarPanels: request.hasSolarPanels,
      solarCapacityKw: request.solarCapacityKw,
      hasBatteryStorage: request.hasBatteryStorage,
      batteryCapacityKwh: request.batteryCapacityKwh,
      electricityRateCopPerKwh: request.electricityRateCopPerKwh,
    });

    // ── Fetch solar data for the selected date window ──────────────────────
    const lat = request.location?.lat ?? 11.5444;
    const lon = request.location?.lng ?? -72.9072;
    const solarResult = await this.getSolarData(startDate, endDate, lat, lon);
    if (solarResult.isFailure) {
      return Result.fail<RecommendationsResponseDto>(solarResult.error);
    }

    const { summary, avgIrradiance, rawDailyData } = solarResult.value;

    // ── Compute solar condition based on hour (Riohacha sunrise ~5:30, sunset ~18:30) ──
    const solarCondition = this.classifySolarConditionByHour(analysisHour);

    // ── Build human-readable datetime label ───────────────────────────────
    const datetimeLabel = analysisDate.toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Bogota',
    }) + ` — ${String(analysisHour).padStart(2, '0')}:${String(analysisDate.getMinutes()).padStart(2, '0')} h`;

    // ── Build location label ───────────────────────────────────────────────
    const locationLabel = request.location
      ? request.location.address
        ? `${request.location.address} (${lat.toFixed(5)}, ${lon.toFixed(5)})`
        : `Riohacha, La Guajira, Colombia — coords (${lat.toFixed(5)}, ${lon.toFixed(5)})`
      : 'Riohacha, La Guajira, Colombia';

    // ── Pre-compute financials for the LLM prompt ─────────────────────────
    const monthlyBillCop = energyProfile.calculateMonthlyCostCop();
    const dailyConsumptionKwh = parseFloat((request.monthlyConsumptionKwh / 30).toFixed(1));
    const solarCapacity = request.solarCapacityKw ?? Math.ceil(request.peakDemandKw * 0.4);
    const potentialSolarGenKwhPerDay = parseFloat((avgIrradiance * solarCapacity * 0.80).toFixed(1));
    const potentialSolarSavingsCopPerMonth = Math.round(potentialSolarGenKwhPerDay * 30 * request.electricityRateCopPerKwh);
    const demandChargeCopPerMonth = Math.round(request.peakDemandKw * 16000); // ~16.000 COP/kW/mes tarifa Caribe
    const analysisMonth = analysisDate.getMonth() + 1; // 1-12
    const season = (analysisMonth >= 11 || analysisMonth <= 4)
      ? 'temporada seca (irradiancia alta, nov–abr)'
      : 'temporada de lluvias (irradiancia moderada, may–oct)';

    // ── Invoke LLM ─────────────────────────────────────────────────────────
    const llmResult = await this.llmPort.generateEnergyRecommendations({
      solarDataSummary: summary,
      rawDailyData,
      energyProfile,
      currentDate: endDate,
      location: locationLabel,
      analysisHour,
      solarCondition,
      datetimeLabel,
      preComputedFinancials: {
        monthlyBillCop,
        dailyConsumptionKwh,
        avgIrradiance,
        potentialSolarGenKwhPerDay,
        potentialSolarSavingsCopPerMonth,
        demandChargeCopPerMonth,
        season,
      },
    });

    if (llmResult.isFailure) {
      return Result.fail<RecommendationsResponseDto>(llmResult.error);
    }

    const recommendation = llmResult.value;
    const savingsCop = recommendation.estimatedSavings * request.electricityRateCopPerKwh;

    return Result.ok<RecommendationsResponseDto>({
      id: recommendation.id,
      businessName: recommendation.businessName,
      businessType: recommendation.businessType,
      date: recommendation.date,
      energyScore: recommendation.energyScore,
      estimatedMonthlySavingsKwh: recommendation.estimatedSavings,
      estimatedMonthlySavingsCop: parseFloat(savingsCop.toFixed(0)),
      recommendations: recommendation.recommendations,
      generatedAt: recommendation.generatedAt.toISOString(),
      solarContext: {
        averageIrradiance: avgIrradiance,
        radiationLevel: this.classifyIrradiance(avgIrradiance),
        solarPotentialKwhPerDay: parseFloat((0.4 * avgIrradiance * 0.8).toFixed(2)),
        analysedLocation: {
          lat: parseFloat(lat.toFixed(5)),
          lng: parseFloat(lon.toFixed(5)),
          address: request.location?.address,
        },
        analysisDatetime: datetimeLabel,
        solarCondition,
      },
    });
  }

  private async getSolarData(
    startDate: string,
    endDate: string,
    lat: number,
    lon: number
  ): Promise<Result<{ summary: string; avgIrradiance: number; rawDailyData: Array<{date: string; irradiance: number}> }>> {

    let solarData = await this.solarRepository.findByDateRange({
      startDate, endDate, latitude: lat, longitude: lon,
    });

    if (solarData.isFailure || solarData.value.length === 0) {
      const apiData = await this.nasaApi.fetchDailyRadiation({
        start: startDate, end: endDate, latitude: lat, longitude: lon,
        community: 'RE', parameters: ['ALLSKY_SFC_SW_DWN'],
      });
      if (apiData.isFailure) return Result.fail(apiData.error);
      await this.solarRepository.save(apiData.value);
      solarData = Result.ok(apiData.value);
    }

    const data = solarData.value;
    const values = data.map((d) => d.irradiance);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    const rawDailyData = data.map(d => ({ date: d.date, irradiance: d.irradiance }));

    const summary = [
      `Datos de radiación solar para Riohacha, La Guajira, Colombia`,
      `Coordenadas: latitud ${lat.toFixed(4)}, longitud ${lon.toFixed(4)}`,
      `Período: ${startDate} a ${endDate}`,
      `Total de registros: ${data.length} días`,
      `Irradiancia promedio: ${avg.toFixed(2)} kWh/m²/día`,
      `Irradiancia máxima: ${max.toFixed(2)} kWh/m²/día`,
      `Irradiancia mínima: ${min.toFixed(2)} kWh/m²/día`,
      `Nivel de radiación: ${this.classifyIrradiance(avg)}`,
      `Potencial solar de la región: MUY ALTO (zona tropical, costa Caribe)`,
    ].join('\n');

    return Result.ok({ summary, avgIrradiance: parseFloat(avg.toFixed(2)), rawDailyData });
  }

  private classifyIrradiance(avg: number): string {
    if (avg >= 6) return 'excelente';
    if (avg >= 4.5) return 'alta';
    if (avg >= 3) return 'media';
    return 'baja';
  }

  /** Riohacha sunrise ~05:30, sunset ~18:30 (UTC-5, tropical) */
  private classifySolarConditionByHour(hour: number): string {
    if (hour < 5 || hour >= 19) return 'noche — sin producción solar';
    if (hour === 5 || hour === 18) return 'amanecer/atardecer — producción mínima';
    if (hour === 6 || hour === 17) return 'baja producción solar (<20% del pico)';
    if (hour === 7 || hour === 16) return 'producción moderada (~40% del pico)';
    if (hour >= 8 && hour <= 9)   return 'producción creciente (~60% del pico)';
    if (hour >= 10 && hour <= 15) return 'pico solar — máxima producción fotovoltaica';
    return 'producción decreciente';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}
