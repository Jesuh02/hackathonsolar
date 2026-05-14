import { SolarDataRepositoryPort } from '../../domain/ports/SolarDataRepositoryPort';
import { NasaPowerApiPort } from '../../domain/ports/NasaPowerApiPort';
import { Result } from '@shared/domain/Result';
import {
  GetSolarDataRequestDto,
  SolarRadiationResponseDto,
  SolarDataPointDto,
} from '../dtos/SolarDataDto';
import { SolarRadiation } from '../../domain/entities/SolarRadiation';

/**
 * Caso de uso: Obtener datos de radiación solar
 * Principio: Single Responsibility - orquesta solo este caso de uso
 */
export class GetSolarRadiationUseCase {
  constructor(
    private readonly repository: SolarDataRepositoryPort,
    private readonly nasaApi: NasaPowerApiPort
  ) {}

  async execute(request: GetSolarDataRequestDto): Promise<Result<SolarRadiationResponseDto>> {
    const latitude = request.latitude ?? 11.5444;
    const longitude = request.longitude ?? -72.9072;

    // Build today's date string (YYYYMMDD) to detect current-day requests
    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    // Skip cache when the range covers today so NASA data is always fresh
    const bypassCache = request.endDate >= todayStr;

    let solarData: SolarRadiation[];

    if (!bypassCache) {
      // Intentar primero desde caché/repositorio
      const cached = await this.repository.findByDateRange({
        startDate: request.startDate,
        endDate: request.endDate,
        latitude,
        longitude,
      });

      if (cached.isSuccess && cached.value.length > 0) {
        solarData = cached.value;
      } else {
        // Obtener de NASA POWER API
        const apiResult = await this.nasaApi.fetchDailyRadiation({
          start: request.startDate,
          end: request.endDate,
          latitude,
          longitude,
          community: 'RE',
          parameters: ['ALLSKY_SFC_SW_DWN'],
        });

        if (apiResult.isFailure) {
          return Result.fail<SolarRadiationResponseDto>(apiResult.error);
        }

        solarData = apiResult.value;
        await this.repository.save(solarData);
      }
    } else {
      // Siempre consultar NASA POWER API para datos actuales
      const apiResult = await this.nasaApi.fetchDailyRadiation({
        start: request.startDate,
        end: request.endDate,
        latitude,
        longitude,
        community: 'RE',
        parameters: ['ALLSKY_SFC_SW_DWN'],
      });

      if (apiResult.isFailure) {
        return Result.fail<SolarRadiationResponseDto>(apiResult.error);
      }

      solarData = apiResult.value;
      // Save to cache with a short TTL (handled by repository default)
      await this.repository.save(solarData);
    }

    return Result.ok<SolarRadiationResponseDto>(this.mapToResponseDto(solarData, latitude, longitude, request));
  }

  private mapToResponseDto(
    data: SolarRadiation[],
    latitude: number,
    longitude: number,
    request: GetSolarDataRequestDto
  ): SolarRadiationResponseDto {
    const irradianceValues = data.map((d) => d.irradiance);
    const total = irradianceValues.reduce((a, b) => a + b, 0);

    const points: SolarDataPointDto[] = data.map((d) => ({
      id: d.id,
      date: d.date,
      irradiance: d.irradiance,
      radiationLevel: d.getRadiationLevel(),
      estimatedPanelOutput: d.estimatePanelOutput(),
      latitude: d.latitude,
      longitude: d.longitude,
      location: d.location,
    }));

    return {
      data: points,
      stats: {
        total: parseFloat(total.toFixed(2)),
        average: parseFloat((total / data.length).toFixed(2)),
        max: parseFloat(Math.max(...irradianceValues).toFixed(2)),
        min: parseFloat(Math.min(...irradianceValues).toFixed(2)),
        period: { start: request.startDate, end: request.endDate },
      },
      location: {
        name: 'Riohacha, La Guajira, Colombia',
        latitude,
        longitude,
      },
    };
  }
}
