import { SolarRadiation } from '../entities/SolarRadiation';
import { Result } from '@shared/domain/Result';

export interface SolarQueryParams {
  startDate: string;  // YYYYMMDD
  endDate: string;    // YYYYMMDD
  latitude: number;
  longitude: number;
}

/**
 * Puerto (interfaz) para el repositorio de datos solares
 * Principio: Dependency Inversion - la capa de aplicación depende de esta abstracción
 */
export interface SolarDataRepositoryPort {
  findByDateRange(params: SolarQueryParams): Promise<Result<SolarRadiation[]>>;
  save(data: SolarRadiation[]): Promise<void>;
  getAnnualStats(year: number, latitude: number, longitude: number): Promise<Result<AnnualSolarStats>>;
}

export interface AnnualSolarStats {
  year: number;
  totalIrradiance: number;
  averageIrradiance: number;
  maxIrradiance: number;
  minIrradiance: number;
  optimalMonths: string[];
  totalRecords: number;
}
