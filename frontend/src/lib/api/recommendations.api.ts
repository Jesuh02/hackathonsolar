import axios from 'axios';
import {
  RecommendationsResponse,
  GenerateRecommendationsRequest,
} from '@/types/recommendations.types';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  timeout: 180000,
});

function sanitizeGenerateRequest(
  request: GenerateRecommendationsRequest
): GenerateRecommendationsRequest {
  const sanitized: GenerateRecommendationsRequest = {
    businessName: request.businessName.trim(),
    businessType: request.businessType,
    monthlyConsumptionKwh: request.monthlyConsumptionKwh,
    peakDemandKw: request.peakDemandKw,
    operatingHoursPerDay: request.operatingHoursPerDay,
    hasSolarPanels: request.hasSolarPanels,
    hasBatteryStorage: request.hasBatteryStorage,
    electricityRateCopPerKwh: request.electricityRateCopPerKwh,
  };

  if (request.analysisDatetime?.trim()) {
    sanitized.analysisDatetime = request.analysisDatetime;
  }

  if (
    request.location &&
    Number.isFinite(request.location.lat) &&
    Number.isFinite(request.location.lng)
  ) {
    sanitized.location = request.location;
  }

  if (request.hasSolarPanels && Number.isFinite(request.solarCapacityKw)) {
    sanitized.solarCapacityKw = request.solarCapacityKw;
  }

  if (request.hasBatteryStorage && Number.isFinite(request.batteryCapacityKwh)) {
    sanitized.batteryCapacityKwh = request.batteryCapacityKwh;
  }

  return sanitized;
}

function extractApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'Error al generar recomendaciones';
  }

  const backendMessage = error.response?.data;
  if (typeof backendMessage?.error === 'string') {
    return backendMessage.error;
  }

  return error.message || 'Error al generar recomendaciones';
}

export const recommendationsApi = {
  generate: async (
    request: GenerateRecommendationsRequest
  ): Promise<RecommendationsResponse> => {
    try {
      const { data } = await apiClient.post<RecommendationsResponse>(
        '/api/recommendations/generate',
        sanitizeGenerateRequest(request)
      );
      return data;
    } catch (error) {
      throw new Error(extractApiErrorMessage(error));
    }
  },

  getDemo: async (type: string = 'hotel'): Promise<RecommendationsResponse> => {
    const { data } = await apiClient.get<RecommendationsResponse>('/api/recommendations/demo', {
      params: { type },
    });
    return data;
  },
};
