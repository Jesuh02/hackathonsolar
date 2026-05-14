'use client';

import { SolarRadiationResponse } from '@/types/solar.types';

interface StatsCardsProps {
  data: SolarRadiationResponse | null;
  isLoading: boolean;
}

interface StatCard {
  label: string;
  value: string;
  unit: string;
  icon: string;
  accent: string;
  bg: string;
  description: string;
}

function SkeletonCard() {
  return (
    <div
      className="relative rounded-2xl border overflow-hidden p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="absolute inset-x-0 top-0 h-[2.5px] shimmer" />
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl shimmer" />
        <div className="h-2.5 w-14 rounded-full shimmer mt-1" />
      </div>
      <div className="h-9 w-2/3 rounded-xl shimmer mb-3" />
      <div className="h-2.5 w-3/4 rounded-full shimmer mb-2" />
      <div className="h-2.5 w-1/2 rounded-full shimmer" />
    </div>
  );
}

export function StatsCards({ data, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;
  const cards: StatCard[] = [
    {
      label: 'Irradiancia Promedio',
      value: stats.average.toFixed(2),
      unit: 'kWh/m²/día',
      icon: '☀️',
      accent: 'var(--accent)',
      bg: 'rgba(245,158,11,0.1)',
      description: 'Promedio diario del período',
    },
    {
      label: 'Irradiancia Máxima',
      value: stats.max.toFixed(2),
      unit: 'kWh/m²/día',
      icon: '🔆',
      accent: 'var(--success)',
      bg: 'rgba(16,185,129,0.1)',
      description: 'Mejor día registrado',
    },
    {
      label: 'Irradiancia Mínima',
      value: stats.min.toFixed(2),
      unit: 'kWh/m²/día',
      icon: '🌤️',
      accent: 'var(--primary)',
      bg: 'rgba(59,130,246,0.1)',
      description: 'Día con menor radiación',
    },
    {
      label: 'Días Registrados',
      value: data.data.length.toString(),
      unit: 'días',
      icon: '📅',
      accent: '#8b5cf6',
      bg: 'rgba(139,92,246,0.1)',
      description: `${stats.period.start.substring(0, 4)} completo`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="card-interactive relative rounded-2xl border overflow-hidden p-5 animate-ios-fade-up"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            animationDelay: `${i * 55}ms`,
          }}
        >
          {/* Colored top accent bar */}
          <div
            className="absolute inset-x-0 top-0 h-[2.5px]"
            style={{ background: `linear-gradient(90deg, ${card.accent} 0%, transparent 80%)` }}
          />

          <div className="flex items-start justify-between mb-4">
            {/* Icon badge */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: card.bg }}
            >
              {card.icon}
            </div>
            <span
              className="text-[9px] uppercase tracking-[0.15em] font-semibold pt-1 text-right leading-tight max-w-[64px]"
              style={{ color: 'var(--fg-muted)' }}
            >
              {card.unit}
            </span>
          </div>

          {/* Big number */}
          <p
            className="text-3xl font-bold num leading-none"
            style={{ color: card.accent }}
          >
            {card.value}
          </p>

          <p className="text-sm font-semibold mt-2 leading-tight" style={{ color: 'var(--fg)' }}>
            {card.label}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
            {card.description}
          </p>
        </div>
      ))}
    </div>
  );
}
