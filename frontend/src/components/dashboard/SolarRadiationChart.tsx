'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { SolarDataPoint } from '@/types/solar.types';

interface SolarRadiationChartProps {
  data: SolarDataPoint[];
  isLoading: boolean;
}

function getBarColor(avg: number): string {
  if (avg >= 6) return '#22c55e';
  if (avg >= 4.5) return '#f59e0b';
  if (avg >= 3) return '#f97316';
  return '#ef4444';
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: WeekBin }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">Semana del {label}</p>
      <p className="font-semibold" style={{ color: getBarColor(d.avg) }}>
        Promedio: {d.avg.toFixed(2)} kWh/m²/día
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Máx: <span className="text-green-400">{d.max.toFixed(2)}</span>
        {' · '}
        Mín: <span className="text-red-400">{d.min.toFixed(2)}</span>
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{d.days} días</p>
    </div>
  );
};

interface WeekBin {
  weekLabel: string;
  avg: number;
  max: number;
  min: number;
  days: number;
}

function buildWeeklyBins(data: SolarDataPoint[]): WeekBin[] {
  const bins: WeekBin[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const week = data.slice(i, Math.min(i + 7, data.length));
    const values = week.map((d) => d.irradiance);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const firstDate = week[0].date;
    bins.push({
      weekLabel: `${firstDate.substring(4, 6)}/${firstDate.substring(6, 8)}`,
      avg: parseFloat(avg.toFixed(2)),
      max: parseFloat(Math.max(...values).toFixed(2)),
      min: parseFloat(Math.min(...values).toFixed(2)),
      days: week.length,
    });
  }
  return bins;
}

export function SolarRadiationChart({ data, isLoading }: SolarRadiationChartProps) {
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

  const bins = buildWeeklyBins(data);
  const globalAvg = parseFloat(
    (data.reduce((a, b) => a + b.irradiance, 0) / data.length).toFixed(2)
  );

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-xs text-gray-400">
        {[{ color: '#22c55e', label: 'Excelente ≥6' }, { color: '#f59e0b', label: 'Alta ≥4.5' }, { color: '#f97316', label: 'Media ≥3' }, { color: '#ef4444', label: 'Baja <3' }].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={bins} margin={{ top: 4, right: 4, left: -20, bottom: 4 }} barCategoryGap="2%">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="weekLabel"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            interval={3}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 8]}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={globalAvg}
            stroke="#6b7280"
            strokeDasharray="4 4"
            label={{ value: `ø${globalAvg}`, fill: '#9ca3af', fontSize: 10, position: 'insideTopRight' }}
          />
          <Bar dataKey="avg" isAnimationActive={false}>
            {bins.map((bin, i) => (
              <Cell key={i} fill={getBarColor(bin.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
