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

    const { summary, avgIrradiance, p50Irradiance, historicalMin, historicalMax, rawDailyData, todayIrradiance } = solarResult.value;

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

    // ── Canonical irradiance = P50 (median histórico, base para financieros) ──
    // NOT today's value (which can be a peak), NOT 30-day average.
    // P50 is the standard for solar project pre-feasibility studies (IEA, IRENA).
    const canonicalIrradiance = p50Irradiance; // P50 median of full history

    // PR 0.75 = industry default for Colombia (accounts for temperature losses,
    // wiring, soiling, mismatch, inverter efficiency — not the optimistic 0.80)
    const pr = 0.75;

    // lossesFactorCaribe = additional losses specific to Caribbean climate:
    // high inverter temperature (−5%), accelerated soiling (−3%),
    // partial shading (−4%), initial degradation (−3%) → total ≈0.85
    // Real system efficiency = PR × lossesFactorCaribe ≈ 0.64 (conservative, auditable)
    const lossesFactorCaribe = 0.85;

    // Autoconsumo factor: fraction of solar generation consumed on-site
    // (not exported to grid). Depends on load profile by business type.
    const autoconsumoFactor =
      GenerateRecommendationsUseCase.autoconsumoByType[request.businessType] ?? 0.75;

    // E (kWh/día) = kWp × HSP × PR × lossesFactorCaribe
    // Ahorro = E × autoconsumo × tarifa
    const potentialSolarGenKwhPerDay = parseFloat((canonicalIrradiance * solarCapacity * pr * lossesFactorCaribe).toFixed(1));
    const potentialSolarSavingsCopPerMonth = Math.round(
      potentialSolarGenKwhPerDay * 30 * autoconsumoFactor * request.electricityRateCopPerKwh
    );

    // Annual generation benchmark: cap at 1800 kWh/kWp/year (max realistic Caribe)
    const annualKwhPerKwp = Math.min(Math.round(canonicalIrradiance * 365 * pr * lossesFactorCaribe), 1800);

    const demandChargeCopPerMonth = Math.round(request.peakDemandKw * 16000);
    const analysisMonth = analysisDate.getMonth() + 1;
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
        canonicalIrradiance,   // = P50, single source of truth for financial calcs
        p50Irradiance,
        historicalMin,
        historicalMax,
        potentialSolarGenKwhPerDay,
        potentialSolarSavingsCopPerMonth,
        demandChargeCopPerMonth,
        season,
        todayIrradiance,
        autoconsumoFactor,
        pr,
        lossesFactorCaribe,
        annualKwhPerKwp,
        maxSavingsCapKwh: Math.round(request.monthlyConsumptionKwh * 0.70),
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

  // In-memory cache for historical solar data (6-hour TTL to avoid hammering NASA API)
  private static historicalCache = new Map<string, { data: Array<{ date: string; irradiance: number }>; fetchedAt: number }>();
  private static readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  /** Autoconsumo factor by business type (fraction of solar generation consumed on-site) */
  private static autoconsumoByType: Record<string, number> = {
    hotel:      0.85, // 24h continuous load → very high self-consumption
    hielera:    0.80, // near-constant cooling load
    retail:     0.75, // diurno, good solar alignment
    oficina:    0.70, // daytime hours align with solar window
    industrial: 0.65, // variable shifts
  };

  private async getSolarData(
    _startDate: string,
    endDate: string,
    lat: number,
    lon: number
  ): Promise<Result<{ summary: string; avgIrradiance: number; p50Irradiance: number; historicalMin: number; historicalMax: number; rawDailyData: Array<{date: string; irradiance: number}>; todayIrradiance: number | null }>> {

    // Always fetch from 2019-01-01 so the LLM has full historical context
    const HISTORICAL_START = '20190101';

    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const bypassCache = endDate >= todayStr;

    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)},${endDate}`;
    const cached = GenerateRecommendationsUseCase.historicalCache.get(cacheKey);

    let allData: Array<{ date: string; irradiance: number }>;

    if (!bypassCache && cached && Date.now() - cached.fetchedAt < GenerateRecommendationsUseCase.CACHE_TTL_MS) {
      allData = cached.data;
    } else {
      // For current-date requests always go to NASA API for fresh data
      const apiData = await this.nasaApi.fetchDailyRadiation({
        start: HISTORICAL_START,
        end: endDate,
        latitude: lat,
        longitude: lon,
        community: 'RE',
        parameters: ['ALLSKY_SFC_SW_DWN'],
      });
      if (apiData.isFailure) return Result.fail(apiData.error);
      await this.solarRepository.save(apiData.value);
      allData = apiData.value.map(d => ({ date: d.date, irradiance: d.irradiance }));
      GenerateRecommendationsUseCase.historicalCache.set(cacheKey, { data: allData, fetchedAt: Date.now() });
    }

    // Most recent day available from NASA (may lag by 1–2 days)
    const todayRecord = allData.find(d => d.date === endDate) ?? allData[allData.length - 1] ?? null;
    const todayIrradiance = todayRecord?.irradiance ?? null;
    const todayDateLabel = todayRecord
      ? `${todayRecord.date.slice(0,4)}-${todayRecord.date.slice(4,6)}-${todayRecord.date.slice(6,8)}`
      : endDate;

    // Last 30 days for the table passed to LLM
    const recent30 = allData.slice(-30);
    const rawDailyData = recent30;

    // Historical monthly averages (last 12 months)
    const byYearMonth = new Map<string, number[]>();
    for (const d of allData) {
      const key = `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}`;
      if (!byYearMonth.has(key)) byYearMonth.set(key, []);
      byYearMonth.get(key)!.push(d.irradiance);
    }
    const sortedKeys = Array.from(byYearMonth.keys()).sort().slice(-13);
    const monthlyLines = sortedKeys.map(key => {
      const vals = byYearMonth.get(key)!;
      const monthAvg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return `  ${key}: ${monthAvg.toFixed(2)} kWh/m²/día`;
    });

    // Recent 30-day stats
    const recent30Values = recent30.map(d => d.irradiance);
    const avg30 = recent30Values.reduce((a, b) => a + b, 0) / recent30Values.length;
    const max30 = Math.max(...recent30Values);
    const min30 = Math.min(...recent30Values);

    // ── P50: true median of full historical daily values ─────────────────
    const allValues = allData.map(d => d.irradiance);
    const sorted = [...allValues].sort((a, b) => a - b);
    const p50Irradiance = parseFloat(sorted[Math.floor(sorted.length / 2)].toFixed(2));
    const historicalMin = parseFloat(sorted[0].toFixed(2));
    const historicalMax = parseFloat(sorted[sorted.length - 1].toFixed(2));

    // Annual averages for context
    const byYear = new Map<string, number[]>();
    for (const d of allData) {
      const yr = d.date.slice(0, 4);
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr)!.push(d.irradiance);
    }
    const yearlyAverageLines = Array.from(byYear.entries())
      .filter(([, vals]) => vals.length > 300)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yr, vals]) => {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        return `  ${yr}: ${avg.toFixed(2)} kWh/m²/día (${vals.length} días)`;
      });

    const avgHistorical = allValues.reduce((a, b) => a + b, 0) / allValues.length;

    const summary = [
      `Datos históricos NASA POWER (ALLSKY_SFC_SW_DWN) 2019–${endDate.slice(0, 4)}`,
      `Coordenadas: latitud ${lat.toFixed(4)}, longitud ${lon.toFixed(4)}`,
      `Total registros: ${allData.length} días`,
      `Irradiancia promedio histórica total: ${avgHistorical.toFixed(2)} kWh/m²/día`,
      `P50 (mediana histórica, usar para financieros): ${p50Irradiance} kWh/m²/día`,
      `Rango histórico: ${historicalMin}–${historicalMax} kWh/m²/día`,
      ``,
      `Promedios anuales (años completos):`,
      ...yearlyAverageLines,
      ``,
      `Promedios mensuales (últimos 13 meses):`,
      ...monthlyLines,
      ``,
      `Estadísticas recientes (últimos 30 días):`,
      `  Promedio: ${avg30.toFixed(2)} kWh/m²/día`,
      `  Máximo:   ${max30.toFixed(2)} kWh/m²/día`,
      `  Mínimo:   ${min30.toFixed(2)} kWh/m²/día`,
      ``,
      todayIrradiance !== null
        ? `Dato más reciente NASA POWER — ${todayDateLabel}: ${todayIrradiance.toFixed(2)} kWh/m²/día (referencia contextual, NO usar para financieros)`
        : `Dato del día actual aún no disponible en NASA POWER`,
      `Nivel de radiación: ${this.classifyIrradiance(p50Irradiance)}`,
      `Potencial solar: MUY ALTO (zona tropical, costa Caribe)`,
    ].join('\n');

    return Result.ok({ summary, avgIrradiance: parseFloat(avg30.toFixed(2)), p50Irradiance, historicalMin, historicalMax, rawDailyData, todayIrradiance });
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
