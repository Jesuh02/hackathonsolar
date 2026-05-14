/**
 * DTOs del módulo Solar - Capa de Aplicación
 * Desacoplan el dominio de la infraestructura HTTP
 */

export interface SolarDataPointDto {
  id: string;
  date: string;
  irradiance: number;
  radiationLevel: 'baja' | 'media' | 'alta' | 'excelente';
  estimatedPanelOutput: number;
  latitude: number;
  longitude: number;
  location: string;
}

export interface SolarRadiationResponseDto {
  data: SolarDataPointDto[];
  stats: {
    total: number;
    average: number;
    max: number;
    min: number;
    period: {
      start: string;
      end: string;
    };
  };
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
}

export interface GetSolarDataRequestDto {
  startDate: string;
  endDate: string;
  latitude?: number;
  longitude?: number;
}
