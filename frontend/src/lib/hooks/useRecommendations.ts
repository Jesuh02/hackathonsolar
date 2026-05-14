'use client';

import { useState, useCallback } from 'react';
import { recommendationsApi } from '@/lib/api/recommendations.api';
import {
  RecommendationsResponse,
  GenerateRecommendationsRequest,
} from '@/types/recommendations.types';

interface UseRecommendationsReturn {
  recommendations: RecommendationsResponse | null;
  isLoading: boolean;
  error: string | null;
  generate: (request: GenerateRecommendationsRequest) => Promise<void>;
  loadDemo: (type?: string) => Promise<void>;
  reset: () => void;
}

export function useRecommendations(): UseRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (request: GenerateRecommendationsRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await recommendationsApi.generate(request);
      setRecommendations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar recomendaciones');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDemo = useCallback(async (type = 'hotel') => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await recommendationsApi.getDemo(type);
      setRecommendations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar demo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRecommendations(null);
    setError(null);
  }, []);

  return { recommendations, isLoading, error, generate, loadDemo, reset };
}
