import axios from 'axios';
import { SolarRadiationResponse } from '@/types/solar.types';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  timeout: 45000,
});

export const solarApi = {
  getRadiationData: async (params: {
    startDate?: string;
    endDate?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<SolarRadiationResponse> => {
    const { data } = await apiClient.get<SolarRadiationResponse>('/api/solar/radiation', {
      params: {
        startDate: params.startDate ?? '20230101',
        endDate: params.endDate ?? '20231231',
        ...(params.latitude && { latitude: params.latitude }),
        ...(params.longitude && { longitude: params.longitude }),
      },
    });
    return data;
  },

  getAnnualStats: async (year: number): Promise<SolarRadiationResponse> => {
    const { data } = await apiClient.get<SolarRadiationResponse>(`/api/solar/stats/${year}`);
    return data;
  },
};
