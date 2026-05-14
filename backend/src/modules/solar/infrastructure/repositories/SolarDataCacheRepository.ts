import NodeCache from 'node-cache';
import {
  SolarDataRepositoryPort,
  SolarQueryParams,
  AnnualSolarStats,
} from '../../domain/ports/SolarDataRepositoryPort';
import { SolarRadiation } from '../../domain/entities/SolarRadiation';
import { Result } from '@shared/domain/Result';

/**
 * Repositorio con caché en memoria - Adaptador de infraestructura
 * En producción reemplazar por adaptador de base de datos (PostgreSQL/TimescaleDB)
 */
export class SolarDataCacheRepository implements SolarDataRepositoryPort {
  private readonly cache: NodeCache;

  constructor(ttlSeconds: number = 3600) {
    this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: 600 });
  }

  async findByDateRange(params: SolarQueryParams): Promise<Result<SolarRadiation[]>> {
    const cacheKey = this.buildCacheKey(params);
    const cached = this.cache.get<SolarRadiation[]>(cacheKey);

    if (cached) {
      return Result.ok<SolarRadiation[]>(cached);
    }

    return Result.ok<SolarRadiation[]>([]);
  }

  async save(data: SolarRadiation[]): Promise<void> {
    if (data.length === 0) return;

    const grouped = this.groupByDateRange(data);
    for (const [key, records] of grouped.entries()) {
      this.cache.set(key, records);
    }
  }

  async getAnnualStats(
    year: number,
    latitude: number,
    longitude: number
  ): Promise<Result<AnnualSolarStats>> {
    const startDate = `${year}0101`;
    const endDate = `${year}1231`;

    const result = await this.findByDateRange({ startDate, endDate, latitude, longitude });

    if (result.isFailure || result.value.length === 0) {
      return Result.fail<AnnualSolarStats>('Sin datos para el año solicitado');
    }

    const data = result.value;
    const irradianceValues = data.map((d) => d.irradiance);
    const totalIrradiance = irradianceValues.reduce((a, b) => a + b, 0);

    const monthlyAvg = this.calculateMonthlyAverages(data);
    const optimalMonths = monthlyAvg
      .filter((m) => m.avg > 5.5)
      .map((m) => m.month);

    return Result.ok<AnnualSolarStats>({
      year,
      totalIrradiance: parseFloat(totalIrradiance.toFixed(2)),
      averageIrradiance: parseFloat((totalIrradiance / data.length).toFixed(2)),
      maxIrradiance: parseFloat(Math.max(...irradianceValues).toFixed(2)),
      minIrradiance: parseFloat(Math.min(...irradianceValues).toFixed(2)),
      optimalMonths,
      totalRecords: data.length,
    });
  }

  private buildCacheKey(params: SolarQueryParams): string {
    return `solar:${params.startDate}:${params.endDate}:${params.latitude}:${params.longitude}`;
  }

  private groupByDateRange(
    data: SolarRadiation[]
  ): Map<string, SolarRadiation[]> {
    if (data.length === 0) return new Map();
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const key = this.buildCacheKey({
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      latitude: sorted[0].latitude,
      longitude: sorted[0].longitude,
    });
    return new Map([[key, data]]);
  }

  private calculateMonthlyAverages(
    data: SolarRadiation[]
  ): Array<{ month: string; avg: number }> {
    const monthMap = new Map<string, number[]>();

    for (const record of data) {
      const monthKey = record.date.substring(0, 6); // YYYYMM
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey)!.push(record.irradiance);
    }

    return Array.from(monthMap.entries()).map(([month, values]) => ({
      month,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }));
  }
}
