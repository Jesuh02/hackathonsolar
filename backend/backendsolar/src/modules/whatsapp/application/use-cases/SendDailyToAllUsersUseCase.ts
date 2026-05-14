import { WhatsAppPort } from '../../domain/ports/WhatsAppPort';
import { GenerateRecommendationsUseCase } from '../../../recommendations/application/use-cases/GenerateRecommendationsUseCase';
import { NasaPowerApiPort } from '../../../solar/domain/ports/NasaPowerApiPort';
import { Result } from '../../../../shared/domain/Result';
import { getSupabaseClient, BusinessProfile } from '../../../../shared/infrastructure/SupabaseClient';
import { BusinessType } from '../../../recommendations/domain/entities/Recommendation';

/**
 * SendDailyToAllUsersUseCase
 * Queries all users with daily_recommendations_enabled=true from Supabase,
 * generates personalised LLM energy recommendations for each, and sends
 * them via WhatsApp.
 */
export class SendDailyToAllUsersUseCase {
  constructor(
    private readonly whatsApp: WhatsAppPort,
    private readonly generateRecommendations: GenerateRecommendationsUseCase,
    private readonly nasaApi: NasaPowerApiPort,
  ) {}

  async execute(): Promise<Result<void>> {
    try {
      const supabase = getSupabaseClient();
      const { data: profiles, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('daily_recommendations_enabled', true);

      if (error) {
        return Result.fail<void>(`Error al obtener perfiles de Supabase: ${error.message}`);
      }

      if (!profiles || profiles.length === 0) {
        console.log('[DailyToAll] No hay usuarios con recomendaciones diarias activas.');
        return Result.ok<void>(undefined as unknown as void);
      }

      const results = await Promise.allSettled(
        (profiles as BusinessProfile[]).map((p) => this.sendToUser(p)),
      );

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.error(`[DailyToAll] ${failures.length} envíos fallaron:`, failures);
      }
      console.log(
        `[DailyToAll] Procesados ${profiles.length} usuarios, ${failures.length} errores.`,
      );
      return Result.ok<void>(undefined as unknown as void);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return Result.fail<void>(msg);
    }
  }

  private async sendToUser(profile: BusinessProfile): Promise<void> {
    const today = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 30);

    // Fetch today's irradiance in parallel with recommendations
    const lat = profile.latitude ?? 11.5444;
    const lng = profile.longitude ?? -72.9072;
    const [recResult, { todayKwh, avg30Kwh }] = await Promise.all([
      this.generateRecommendations.execute({
        businessName: profile.business_name,
        businessType: profile.business_type as BusinessType,
        monthlyConsumptionKwh: profile.monthly_consumption_kwh,
        peakDemandKw: profile.peak_demand_kw,
        operatingHoursPerDay: profile.operating_hours_per_day,
        hasSolarPanels: profile.has_solar_panels,
        hasBatteryStorage: profile.has_battery_storage,
        electricityRateCopPerKwh: profile.electricity_rate_cop_per_kwh,
        location: {
          lat,
          lng: lng,
          address: profile.address,
        },
        startDate: fmt(windowStart),
        endDate: fmt(today),
      }),
      this.fetchTodayIrradiance(lat, lng),
    ]);

    if (recResult.isFailure) {
      throw new Error(`Recommendations failed for ${profile.phone}: ${recResult.error}`);
    }

    const rec = recResult.value;
    const dayLabel = today.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Bogota',
    });

    const topRecs = rec.recommendations.slice(0, 3);
    const lines: string[] = [
      `☀️ *Recomendaciones diarias de ahorro energético*`,
      `📅 ${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}`,
      `🏪 *${profile.business_name}*`,
      `📍 ${profile.address}`,
      ``,
    ];

    // Include today's irradiance from NASA POWER API
    if (todayKwh !== null) {
      const trend = avg30Kwh !== null
        ? todayKwh >= avg30Kwh
          ? `▲ sobre el promedio (${avg30Kwh} kWh/m²/día)`
          : `▼ bajo el promedio (${avg30Kwh} kWh/m²/día)`
        : '';
      lines.push(`🌞 *Radiación solar hoy (NASA POWER):* ${todayKwh.toFixed(2)} kWh/m²/día ${trend}`);
      lines.push(``);
    }

    lines.push(
      `📊 *Puntuación energética:* ${rec.energyScore}/100`,
      `💡 *Ahorro estimado:* ${rec.estimatedMonthlySavingsKwh.toFixed(0)} kWh/mes (~${this.formatCop(rec.estimatedMonthlySavingsCop)})`,
      ``,
      `*Recomendaciones de hoy:*`,
    );

    topRecs.forEach((r, i) => {
      const icon = r.priority === 'critica' ? '🔴' : r.priority === 'alta' ? '🟠' : '🟡';
      lines.push(``, `${icon} *${i + 1}. ${r.title}*`, r.description, `➡️ ${r.action}`);
    });

    lines.push(``, `_Agente Solar · Riohacha, La Guajira_`);
    lines.push(`_Responde cualquier pregunta sobre energía solar 👋_`);

    const sendResult = await this.whatsApp.sendMessage({ to: profile.phone, body: lines.join('\n') });
    if (sendResult.isFailure) {
      throw new Error(sendResult.error);
    }
  }

  /** Fetches today's irradiance and a 30-day average for the given coordinates. */
  private async fetchTodayIrradiance(
    lat: number,
    lng: number,
  ): Promise<{ todayKwh: number | null; avg30Kwh: number | null }> {
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const window30Start = new Date(today);
    window30Start.setDate(window30Start.getDate() - 30);

    try {
      const result = await this.nasaApi.fetchDailyRadiation({
        start: fmt(window30Start),
        end: fmt(today),
        latitude: lat,
        longitude: lng,
        community: 'RE',
        parameters: ['ALLSKY_SFC_SW_DWN'],
      });

      if (result.isFailure || result.value.length === 0) {
        return { todayKwh: null, avg30Kwh: null };
      }

      const data = result.value;
      const todayStr = fmt(today);
      const todayRecord = data.find((d) => d.date === todayStr);
      const avg30 = data.reduce((s, d) => s + d.irradiance, 0) / data.length;

      return {
        todayKwh: todayRecord?.irradiance ?? data[data.length - 1]?.irradiance ?? null,
        avg30Kwh: parseFloat(avg30.toFixed(2)),
      };
    } catch {
      return { todayKwh: null, avg30Kwh: null };
    }
  }

  private formatCop(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M COP`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k COP`;
    return `$${amount.toFixed(0)} COP`;
  }
}
