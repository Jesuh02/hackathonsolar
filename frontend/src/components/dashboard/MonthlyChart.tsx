'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ErrorBar,
} from 'recharts';
import { MonthlyAggregate } from '@/types/solar.types';

interface MonthlyChartProps {
  data: MonthlyAggregate[];
  isLoading: boolean;
}

const getBarColor = (avg: number): string => {
  if (avg >= 6) return '#22c55e';
  if (avg >= 4.5) return '#eab308';
  if (avg >= 3) return '#f97316';
  return '#ef4444';
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: MonthlyAggregate }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-semibold" style={{ color: getBarColor(d.avgIrradiance) }}>
        Promedio: {d.avgIrradiance.toFixed(2)} kWh/m²/día
      </p>
      <div className="flex gap-3 mt-1 text-xs">
        <span className="text-green-400">↑ Máx: {d.maxIrradiance.toFixed(2)}</span>
        <span className="text-red-400">↓ Mín: {d.minIrradiance.toFixed(2)}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Total: {d.totalIrradiance.toFixed(1)} kWh/m² · {d.daysCount} días
      </p>
    </div>
  );
};

export function MonthlyChart({ data, isLoading }: MonthlyChartProps) {
  if (isLoading) {
    return <div className="h-72 bg-gray-800 rounded-lg animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-gray-500">
        Sin datos disponibles
      </div>
    );
  }

  const overallAvg = parseFloat(
    (data.reduce((a, b) => a + b.avgIrradiance, 0) / data.length).toFixed(2)
  );

  // Attach error bar data: [below avg, above avg]
  const chartData = data.map((d) => ({
    ...d,
    errorLow: parseFloat((d.avgIrradiance - d.minIrradiance).toFixed(2)),
    errorHigh: parseFloat((d.maxIrradiance - d.avgIrradiance).toFixed(2)),
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Barras de error: rango mín–máx diario</span>
        <span>Promedio anual: <strong className="text-gray-200">{overallAvg} kWh/m²/día</strong></span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }} barCategoryGap="4%">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 9]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={overallAvg}
            stroke="#6b7280"
            strokeDasharray="4 4"
            label={{ value: `ø${overallAvg}`, fill: '#9ca3af', fontSize: 10, position: 'insideTopRight' }}
          />
          <Bar dataKey="avgIrradiance" isAnimationActive={false}>
            <ErrorBar dataKey="errorLow" width={4} strokeWidth={1.5} stroke="#9ca3af" {...({ direction: 'minus' } as object)} />
            <ErrorBar dataKey="errorHigh" width={4} strokeWidth={1.5} stroke="#9ca3af" {...({ direction: 'plus' } as object)} />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.avgIrradiance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
