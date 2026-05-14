'use client';

import { useState, useEffect, useCallback } from 'react';
import { solarApi } from '@/lib/api/solar.api';
import { SolarRadiationResponse, MonthlyAggregate, MONTH_NAMES } from '@/types/solar.types';

interface UseSolarDataOptions {
  startDate?: string;
  endDate?: string;
  latitude?: number;
  longitude?: number;
}

interface UseSolarDataReturn {
  data: SolarRadiationResponse | null;
  monthlyAggregates: MonthlyAggregate[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSolarData(options: UseSolarDataOptions = {}): UseSolarDataReturn {
  const [data, setData] = useState<SolarRadiationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await solarApi.getRadiationData({
        startDate: options.startDate ?? '20230101',
        endDate: options.endDate ?? '20231231',
        latitude: options.latitude,
        longitude: options.longitude,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos solares');
    } finally {
      setIsLoading(false);
    }
  }, [options.startDate, options.endDate, options.latitude, options.longitude]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthlyAggregates = data ? computeMonthlyAggregates(data) : [];

  return { data, monthlyAggregates, isLoading, error, refetch: fetchData };
}

function computeMonthlyAggregates(data: SolarRadiationResponse): MonthlyAggregate[] {
  const monthMap = new Map<string, number[]>();

  for (const point of data.data) {
    const monthKey = point.date.substring(0, 6); // YYYYMM
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
    monthMap.get(monthKey)!.push(point.irradiance);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const total = values.reduce((a, b) => a + b, 0);
      const monthCode = key.substring(4, 6);
      return {
        month: key,
        monthLabel: MONTH_NAMES[monthCode] ?? monthCode,
        avgIrradiance: parseFloat((total / values.length).toFixed(2)),
        totalIrradiance: parseFloat(total.toFixed(2)),
        maxIrradiance: parseFloat(Math.max(...values).toFixed(2)),
        minIrradiance: parseFloat(Math.min(...values).toFixed(2)),
        daysCount: values.length,
      };
    });
}
