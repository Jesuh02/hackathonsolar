import { WhatsAppPort } from '../../domain/ports/WhatsAppPort';
import { GenerateRecommendationsUseCase } from '../../../recommendations/application/use-cases/GenerateRecommendationsUseCase';
import { NasaPowerApiPort } from '../../../solar/domain/ports/NasaPowerApiPort';
import { Result } from '@shared/domain/Result';

/** Static profile for Panadería Don Humberto - Riohacha */
const COMPANY_PROFILE = {
  businessName: 'Panadería Don Humberto',
  businessType: 'retail' as const,
  monthlyConsumptionKwh: 5000,
  peakDemandKw: 20,
  operatingHoursPerDay: 12,
  hasSolarPanels: false,
  hasBatteryStorage: false,
  electricityRateCopPerKwh: 750,
  location: {
    lat: 11.5444,
    lng: -72.9072,
    address: 'Cra 14A #28-26, Riohacha, La Guajira',
  },
};

export class SendDailyRecommendationUseCase {
  constructor(
    private readonly whatsApp: WhatsAppPort,
    private readonly generateRecommendations: GenerateRecommendationsUseCase,
    private readonly companyPhone: string,
    private readonly nasaApi: NasaPowerApiPort
  ) {}

  async execute(): Promise<Result<void>> {
    if (!this.companyPhone) {
      return Result.fail<void>('WHATSAPP_COMPANY_PHONE no está configurado');
    }

    // Fetch today's LLM recommendations
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 30);
    const startStr = `${windowStart.getFullYear()}${String(windowStart.getMonth() + 1).padStart(2, '0')}${String(windowStart.getDate()).padStart(2, '0')}`;

    const recResult = await this.generateRecommendations.execute({
      ...COMPANY_PROFILE,
      startDate: startStr,
      endDate: dateStr,
    });

    if (recResult.isFailure) {
      return Result.fail<void>(`No se pudieron generar recomendaciones: ${recResult.error}`);
    }

    // Fetch today's irradiance from NASA POWER API
    const { lat, lng } = COMPANY_PROFILE.location;
    let todayIrradiance: number | null = null;
    let avg30Irradiance: number | null = null;
    try {
      const solarResult = await this.nasaApi.fetchDailyRadiation({
        start: startStr,
        end: dateStr,
        latitude: lat,
        longitude: lng,
        community: 'RE',
        parameters: ['ALLSKY_SFC_SW_DWN'],
      });
      if (solarResult.isSuccess && solarResult.value.length > 0) {
        const data = solarResult.value;
        const todayRecord = data.find((d) => d.date === dateStr);
        todayIrradiance = todayRecord?.irradiance ?? data[data.length - 1]?.irradiance ?? null;
        avg30Irradiance = parseFloat(
          (data.reduce((s, d) => s + d.irradiance, 0) / data.length).toFixed(2)
        );
      }
    } catch {
      // Non-critical: proceed without irradiance value
    }

    const rec = recResult.value;
    const dayLabel = today.toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
    });

    // Build WhatsApp message (max ~1500 chars for readability)
    const topRecs = rec.recommendations.slice(0, 3);
    const lines: string[] = [
      `☀️ *Recomendaciones diarias de ahorro energético*`,
      `📅 ${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}`,
      `🏪 *${COMPANY_PROFILE.businessName}*`,
      `📍 ${COMPANY_PROFILE.location.address}`,
      ``,
    ];

    // Include today's irradiance from NASA POWER API
    if (todayIrradiance !== null) {
      const trend = avg30Irradiance !== null
        ? todayIrradiance >= avg30Irradiance
          ? `▲ sobre el promedio (${avg30Irradiance} kWh/m²/día)`
          : `▼ bajo el promedio (${avg30Irradiance} kWh/m²/día)`
        : '';
      lines.push(`🌞 *Radiación solar hoy (NASA POWER):* ${todayIrradiance.toFixed(2)} kWh/m²/día ${trend}`);
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

    const body = lines.join('\n');
    return this.whatsApp.sendMessage({ to: this.companyPhone, body });
  }

  private formatCop(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  }
}
