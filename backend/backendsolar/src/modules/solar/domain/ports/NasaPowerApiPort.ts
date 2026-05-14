import { SolarRadiation } from '../entities/SolarRadiation';
import { Result } from '@shared/domain/Result';

export interface NasaPowerQueryParams {
  start: string;       // YYYYMMDD
  end: string;         // YYYYMMDD
  latitude: number;
  longitude: number;
  community: string;
  parameters: string[];
}

/**
 * Puerto para la API externa de NASA POWER
 * Principio: Interface Segregation - interfaz mínima necesaria
 */
export interface NasaPowerApiPort {
  fetchDailyRadiation(params: NasaPowerQueryParams): Promise<Result<SolarRadiation[]>>;
}
