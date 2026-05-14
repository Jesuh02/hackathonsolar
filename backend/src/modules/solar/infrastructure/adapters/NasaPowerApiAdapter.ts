import { NasaPowerApiPort, NasaPowerQueryParams } from '../../domain/ports/NasaPowerApiPort';
import { SolarRadiation } from '../../domain/entities/SolarRadiation';
import { Result } from '@shared/domain/Result';
import { HttpClient } from '@shared/infrastructure/HttpClient';

interface NasaPowerApiResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>;
    };
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

/**
 * Adaptador para la API de NASA POWER
 * Puerto secundario (driven adapter) - implementa NasaPowerApiPort
 */
export class NasaPowerApiAdapter implements NasaPowerApiPort {
  private readonly httpClient: HttpClient;
  private static readonly LOCATION = 'Riohacha, La Guajira, Colombia';

  constructor(baseUrl: string) {
    this.httpClient = new HttpClient(baseUrl, 45000);
  }

  async fetchDailyRadiation(params: NasaPowerQueryParams): Promise<Result<SolarRadiation[]>> {
    try {
      const queryParams = new URLSearchParams({
        start: params.start,
        end: params.end,
        latitude: params.latitude.toString(),
        longitude: params.longitude.toString(),
        community: params.community,
        parameters: params.parameters.join(','),
        format: 'JSON',
      });

      const response = await this.httpClient.get<NasaPowerApiResponse>(
        `/temporal/daily/point?${queryParams.toString()}`
      );

      const rawData = response.properties.parameter.ALLSKY_SFC_SW_DWN;
      const solarData = this.mapResponseToEntities(rawData, params.latitude, params.longitude);

      return Result.ok<SolarRadiation[]>(solarData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido en NASA POWER API';
      return Result.fail<SolarRadiation[]>(`NasaPowerApiAdapter: ${message}`);
    }
  }

  private mapResponseToEntities(
    rawData: Record<string, number>,
    latitude: number,
    longitude: number
  ): SolarRadiation[] {
    return Object.entries(rawData)
      .filter(([, value]) => value !== -999) // Filtrar valores inválidos de NASA
      .map(([dateStr, irradiance]) =>
        SolarRadiation.create({
          date: dateStr,
          irradiance,
          latitude,
          longitude,
          location: NasaPowerApiAdapter.LOCATION,
        })
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
