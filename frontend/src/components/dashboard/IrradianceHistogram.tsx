'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { solarApi } from '@/lib/api/solar.api';
import { SolarDataPoint } from '@/types/solar.types';

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function std(vals: number[], mu: number): number {
  return Math.sqrt(vals.reduce((acc, v) => acc + (v - mu) ** 2, 0) / vals.length);
}

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function kdeAt(vals: number[], x: number, h: number): number {
  const gauss = (u: number) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
  return vals.reduce((acc, xi) => acc + gauss((x - xi) / h), 0) / (vals.length * h);
}

/** Returns 1-5: which week of the month the day falls in (days 1-7 → 1, 8-14 → 2, …) */
function weekOfMonth(dateStr: string): number {
  const day = parseInt(dateStr.slice(6, 8), 10);
  return Math.ceil(day / 7);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

const MONTHS = [
  { v: 0,  l: 'Todos' },
  { v: 1,  l: 'Ene' }, { v: 2,  l: 'Feb' }, { v: 3,  l: 'Mar' },
  { v: 4,  l: 'Abr' }, { v: 5,  l: 'May' }, { v: 6,  l: 'Jun' },
  { v: 7,  l: 'Jul' }, { v: 8,  l: 'Ago' }, { v: 9,  l: 'Sep' },
  { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dic' },
];

const WEEK_OPTIONS = [
  { v: 0, l: 'Todas' },
  { v: 1, l: 'S1 (1–7)' },
  { v: 2, l: 'S2 (8–14)' },
  { v: 3, l: 'S3 (15–21)' },
  { v: 4, l: 'S4 (22–28)' },
  { v: 5, l: 'S5 (29–31)' },
];

const NUM_BINS  = 9;
const NUM_CURVE = 80;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarPoint   { x: number; density: number }
interface CurvePoint { x: number; normal: number; kde: number }

interface Computed {
  barData:   BarPoint[];
  curveData: CurvePoint[];
  mu:        number;
  sigma:     number;
  n:         number;
  xMin:      number;
  xMax:      number;
  maxY:      number;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TEntry { name: string; value: number | null; color: string; dataKey: string }

const CustomTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: TEntry[]; label?: number }) => {
  if (!active || !payload?.length || label === undefined) return null;
  const LABELS: Record<string, string> = {
    density: 'Densidad empírica',
    normal:  'Normal estimada',
    kde:     'Estimador de núcleo',
  };
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-2xl min-w-[200px]">
      <p className="text-gray-400 mb-2 font-medium">{`x = ${Number(label).toFixed(3)} kWh/m²/día`}</p>
      {payload.map((e) =>
        e.value == null ? null : (
          <div key={e.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: e.color }} />
            <span className="text-gray-300">{LABELS[e.dataKey] ?? e.name}:</span>
            <span className="font-semibold text-white ml-auto pl-3">{e.value.toFixed(5)}</span>
          </div>
        ),
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

interface IrradianceHistogramProps {
  latitude?:  number;
  longitude?: number;
}

export function IrradianceHistogram({ latitude, longitude }: IrradianceHistogramProps) {
  const [allData, setAllData] = useState<SolarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [filterYear,  setFilterYear]  = useState<number>(0);
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterWeek,  setFilterWeek]  = useState<number>(0);

  // Fetch each year in parallel to avoid hitting single-request size limits
  useEffect(() => {
    setLoading(true);
    setError(null);
    setAllData([]);

    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const currentYear = now.getFullYear();

    const requests = AVAILABLE_YEARS.map((year) => {
      const start = `${year}0101`;
      const end   = year < currentYear ? `${year}1231` : todayStr;
      return solarApi
        .getRadiationData({ startDate: start, endDate: end, latitude, longitude })
        .then((r) => r.data)
        .catch(() => [] as SolarDataPoint[]);
    });

    Promise.all(requests).then((chunks) => {
      const flat = chunks.flat();
      if (flat.length === 0) {
        setError('No se obtuvieron datos del servidor. Verifica la conexión e intenta de nuevo.');
      } else {
        setAllData(flat);
      }
      setLoading(false);
    });
  }, [latitude, longitude]);

  // Filter
  const filteredValues = useMemo<number[]>(() => {
    return allData
      .filter((d) => {
        if (filterYear  && parseInt(d.date.slice(0, 4), 10) !== filterYear)  return false;
        if (filterMonth && parseInt(d.date.slice(4, 6), 10) !== filterMonth) return false;
        if (filterWeek  && weekOfMonth(d.date) !== filterWeek)               return false;
        return true;
      })
      .map((d) => d.irradiance);
  }, [allData, filterYear, filterMonth, filterWeek]);

  // Build histogram bins and smooth density curves (separate data arrays)
  const computed = useMemo<Computed | null>(() => {
    const vals = filteredValues;
    if (vals.length < 2) return null;

    const n     = vals.length;
    const mu    = mean(vals);
    const sigma = std(vals, mu);
    const h     = sigma <= 0 ? 0.5 : 1.06 * sigma * Math.pow(n, -0.2); // Silverman bandwidth

    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const pad    = Math.max((rawMax - rawMin) * 0.12, 0.3);
    const xMin   = rawMin - pad;
    const xMax   = rawMax + pad;

    // Use fewer bins for small datasets so bars are visible
    const numBins = n <= 7 ? Math.max(2, n - 1) : NUM_BINS;
    const binWidth = (rawMax - rawMin) / numBins;
    if (binWidth <= 0) {
      // All values identical — single bar
      const barData: BarPoint[] = [{ x: parseFloat(rawMin.toFixed(4)), density: 1 }];
      return { barData, curveData: [], mu, sigma, n, xMin, xMax, maxY: 1 };
    }

    const counts = new Array<number>(numBins).fill(0);
    vals.forEach((v) => {
      let i = Math.floor((v - rawMin) / binWidth);
      if (i >= numBins) i = numBins - 1;
      if (i < 0) i = 0;
      counts[i]++;
    });

    // barData: one point per bin, positioned at bin center
    const barData: BarPoint[] = counts.map((c, i) => ({
      x:       parseFloat((rawMin + (i + 0.5) * binWidth).toFixed(4)),
      density: parseFloat((c / (n * binWidth)).toFixed(6)),
    }));

    // Only draw smooth curves when there are enough points
    const curveData: CurvePoint[] = n < 5 ? [] : Array.from({ length: NUM_CURVE }, (_, i) => {
      const x = xMin + (i / (NUM_CURVE - 1)) * (xMax - xMin);
      return {
        x:      parseFloat(x.toFixed(4)),
        normal: parseFloat(normalPdf(x, mu, sigma).toFixed(6)),
        kde:    parseFloat(kdeAt(vals, x, h).toFixed(6)),
      };
    });

    const maxY = Math.max(
      ...barData.map((b) => b.density),
      ...curveData.map((c) => Math.max(c.normal, c.kde)),
    );

    return { barData, curveData, mu, sigma, n, xMin, xMax, maxY };
  }, [filteredValues]);

  const filterLabel = [
    filterYear  ? String(filterYear)                          : '2019–2026',
    filterMonth ? MONTHS.find((m) => m.v === filterMonth)?.l : null,
    filterWeek  ? WEEK_OPTIONS.find((w) => w.v === filterWeek)?.l ?? `Sem. ${filterWeek}` : null,
  ].filter(Boolean).join(' · ');

  const hasFilters = filterYear !== 0 || filterMonth !== 0 || filterWeek !== 0;

  return (
    <div className="space-y-4">

      {/* ── Controls ── */}
      <div className="space-y-3">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12 pt-1 shrink-0">Año</span>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFilterYear(0)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterYear === 0 ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
            >Todos</button>
            {AVAILABLE_YEARS.map((y) => (
              <button key={y} onClick={() => setFilterYear(y)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterYear === y ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
              >{y}</button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-12 pt-1 shrink-0">Mes</span>
          <div className="flex flex-wrap gap-1">
            {MONTHS.map(({ v, l }) => (
              <button key={v} onClick={() => setFilterMonth(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterMonth === v ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
              >{l}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-12 shrink-0">Semana</span>
          <select value={filterWeek} onChange={(e) => setFilterWeek(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {WEEK_OPTIONS.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setFilterYear(0); setFilterMonth(0); setFilterWeek(0); }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-gray-800"
            >✕ Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      {computed && !loading && (
        <div className="flex items-center gap-4 flex-wrap bg-gray-800/60 rounded-lg px-4 py-2.5 border border-gray-700/50 text-xs text-gray-400">
          <span><span className="text-gray-500">Filtro: </span><span className="text-cyan-300 font-medium">{filterLabel}</span></span>
          <span className="w-px h-4 bg-gray-700 inline-block" />
          <span><span className="text-gray-500">n = </span><span className="text-white font-medium">{computed.n.toLocaleString()}</span></span>
          <span><span className="text-gray-500">μ = </span><span className="text-white font-medium">{computed.mu.toFixed(3)}</span><span className="text-gray-600 ml-0.5">kWh/m²/día</span></span>
          <span><span className="text-gray-500">σ = </span><span className="text-white font-medium">{computed.sigma.toFixed(3)}</span></span>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="h-80 flex flex-col items-center justify-center gap-3 text-gray-500">
          <span className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando datos 2019 – 2026…</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="h-80 flex items-center justify-center text-red-400 text-sm bg-red-950/20 rounded-xl border border-red-800/30 px-6 text-center">
          {error}
        </div>
      )}

      {/* ── No data ── */}
      {!loading && !error && !computed && (
        <div className="h-80 flex flex-col items-center justify-center gap-2 text-gray-500 text-sm">
          <span>Sin datos para el filtro seleccionado</span>
          <span className="text-xs text-gray-600">Selecciona un rango más amplio o revisa la conexión con la API</span>
        </div>
      )}

      {/* ── Chart ── */}
      {!loading && !error && computed && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-5 text-xs text-gray-400 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded-sm inline-block border border-cyan-400/50" style={{ background: '#67e8f9', opacity: 0.8 }} />
              Densidad empírica
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-6 border-t-2 border-blue-500" />
              Densidad normal estimada
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-6 border-t-2 border-red-500" />
              Estimador de núcleo de la densidad
            </span>
          </div>

          {/*
            KEY FIX: ResponsiveContainer does NOT accept a function child in Recharts v2.
            Bar and Line each receive their own `data` prop so they use separate arrays.
          */}
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart margin={{ top: 14, right: 20, left: 4, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

              <XAxis
                dataKey="x"
                type="number"
                domain={[
                  parseFloat(computed.xMin.toFixed(2)),
                  parseFloat(computed.xMax.toFixed(2)),
                ]}
                tickFormatter={(v: number) => v.toFixed(1)}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#374151' }}
                label={{
                  value: 'Irradiancia (kWh/m²/día)',
                  position: 'insideBottom',
                  offset: -18,
                  fill: '#6b7280',
                  fontSize: 11,
                }}
                scale="linear"
                allowDataOverflow={false}
              />

              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(3)}
                domain={[0, parseFloat((computed.maxY * 1.18).toFixed(4))]}
                label={{
                  value: 'Densidad',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 12,
                  fill: '#6b7280',
                  fontSize: 11,
                }}
                width={66}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#374151', strokeWidth: 1 }}
              />

              <ReferenceLine
                x={computed.mu}
                stroke="#6b7280"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: `μ=${computed.mu.toFixed(2)}`, fill: '#9ca3af', fontSize: 10, position: 'insideTopRight' }}
              />

              {/* Bars use their own data — bin centers + density */}
              <Bar
                data={computed.barData}
                dataKey="density"
                barSize={52}
                fill="#67e8f9"
                fillOpacity={0.72}
                stroke="#22d3ee"
                strokeWidth={0.8}
                isAnimationActive={false}
                name="Densidad"
              />

              {/* Lines use curveData */}
              <Line
                data={computed.curveData}
                dataKey="normal"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                type="monotone"
                isAnimationActive={false}
                connectNulls
                name="Normal estimada"
              />

              <Line
                data={computed.curveData}
                dataKey="kde"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                type="monotone"
                isAnimationActive={false}
                connectNulls
                name="Estimador de núcleo"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
