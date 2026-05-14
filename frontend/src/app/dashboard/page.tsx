'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSolarData } from '@/lib/hooks/useSolarData';
import { useRecommendations } from '@/lib/hooks/useRecommendations';
import { SolarRadiationChart } from '@/components/dashboard/SolarRadiationChart';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RecommendationsPanel } from '@/components/dashboard/RecommendationsPanel';
import { BusinessForm } from '@/components/dashboard/BusinessForm';
import { WhatsAppOtpModal } from '@/components/dashboard/WhatsAppOtpModal';
import { ReportGeneratorModal } from '@/components/dashboard/ReportGeneratorModal';
import { IrradianceHistogram } from '@/components/dashboard/IrradianceHistogram';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { GenerateRecommendationsRequest, BusinessType } from '@/types/recommendations.types';
import { WhatsAppVerificationState } from '@/types/whatsapp.types';
import type { SelectedLocation } from '@/components/dashboard/LocationPicker';

// Dynamic import — maplibre-gl requires window (no SSR)
const LocationPicker = dynamic(
  () => import('@/components/dashboard/LocationPicker').then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] flex items-center justify-center text-[var(--fg-muted)] text-sm">
        <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin inline-block mr-3" />
        Cargando mapa…
      </div>
    ),
  }
);

export default function DashboardPage() {
  const [mapLocation, setMapLocation] = useState<SelectedLocation | null>(null);
  const [selectedYear, setSelectedYear] = useState(2023);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [whatsAppState, setWhatsAppState] = useState<WhatsAppVerificationState>({ isVerified: false, phone: null });

  const CURRENT_YEAR = new Date().getFullYear();
  const AVAILABLE_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

  const endDate = (() => {
    if (selectedYear < CURRENT_YEAR) return `${selectedYear}1231`;
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  })();

  const { data, monthlyAggregates, isLoading: solarLoading, error: solarError } = useSolarData({
    startDate: `${selectedYear}0101`,
    endDate,
    latitude: mapLocation?.lat,
    longitude: mapLocation?.lng,
  });
  const { recommendations, isLoading: recLoading, error: recError, generate, loadDemo } = useRecommendations();

  const handleGenerateRecommendations = async (request: GenerateRecommendationsRequest) => {
    await generate(request);
    // Smooth scroll to recommendations panel
    setTimeout(() => {
      document.getElementById('recommendations-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const handleLoadDemo = async (type: BusinessType) => {
    await loadDemo(type);
    setTimeout(() => {
      document.getElementById('recommendations-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const handleLocationChange = useCallback((loc: SelectedLocation) => {
    setMapLocation(loc);
  }, []);

  const scrollToAgent = () => {
    document.getElementById('agent-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {showWhatsAppModal && (
        <WhatsAppOtpModal
          onVerified={(state) => setWhatsAppState(state)}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}
      {showReportModal && (
        <ReportGeneratorModal onClose={() => setShowReportModal(false)} />
      )}

      {/* ─── Header (frosted, sticky) ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-gray-800 backdrop-blur-2xl"
        style={{ background: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between flex-wrap gap-3 animate-ios-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl solar-gradient flex items-center justify-center text-xl shadow-lg">
              ☀️
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">Agente Solar</h1>
              <p className="text-[11px] text-gray-400">Riohacha · La Guajira</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowReportModal(true)}
              className="tactile flex items-center gap-1.5 px-3.5 py-2 bg-[var(--primary)] hover:opacity-95 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              <span>📊</span> Generar Reporte
            </button>

            {whatsAppState.isVerified ? (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-green-900/50 border border-green-700 text-green-300 text-xs font-medium rounded-xl">
                <span>💬</span>
                <span className="hidden sm:inline">{whatsAppState.phone}</span>
                <span className="text-green-400">✓</span>
              </div>
            ) : (
              <button
                onClick={() => setShowWhatsAppModal(true)}
                className="tactile flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:opacity-95 text-white text-xs font-semibold rounded-xl"
              >
                <span>💬</span> WhatsApp
              </button>
            )}

            <button
              onClick={scrollToAgent}
              className="tactile hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl border border-gray-700"
            >
              🤖 Agente IA
            </button>

            <div className="pl-1">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero subtitle */}
        <section className="relative animate-ios-fade-up overflow-hidden">
          {/* Atmospheric glow blobs */}
          <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
            <div
              className="hero-glow absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full"
              style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 68%)' }}
            />
            <div
              className="hero-glow absolute -top-16 right-0 w-[340px] h-[340px] rounded-full"
              style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 68%)', animationDelay: '4.5s' }}
            />
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] font-semibold">Dashboard</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-1" style={{ color: 'var(--fg)' }}>
            Radiación Solar Histórica
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--fg-3)' }}>
            Datos NASA POWER · 2019 – {CURRENT_YEAR} · Análisis y proyecciones para Riohacha
          </p>
        </section>

        {solarError && (
          <div className="animate-ios-fade-up bg-red-900/30 border border-red-700 rounded-2xl p-4 text-red-300 text-sm">
            <strong>Error:</strong> {solarError}
          </div>
        )}

        {/* Year filter — iOS segmented control */}
        <section className="flex items-center gap-3 flex-wrap animate-ios-fade-up" style={{ animationDelay: '60ms' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>Año</span>
          <div
            className="flex gap-0.5 rounded-2xl p-1 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {AVAILABLE_YEARS.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className="tactile relative px-3.5 py-1.5 rounded-xl text-xs font-semibold"
                style={selectedYear === year ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  boxShadow: '0 2px 10px rgba(245,158,11,0.35)',
                } : {
                  color: 'var(--fg-3)',
                  background: 'transparent',
                }}
              >
                {year}
              </button>
            ))}
          </div>
          {solarLoading && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--fg-muted)' }}>
              <span className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin inline-block" />
              Cargando…
            </span>
          )}
        </section>

        {/* Stats Cards */}
        <section className="stagger">
          <StatsCards data={data} isLoading={solarLoading} />
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 stagger">
          <div className="lift rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-1" style={{ color: 'var(--fg-muted)' }}>Irradiancia semanal</p>
            <h3 className="text-base font-semibold tracking-tight mb-4" style={{ color: 'var(--fg)' }}>
              Histograma <span className="font-normal" style={{ color: 'var(--fg-3)' }}>· {selectedYear}</span>
            </h3>
            <SolarRadiationChart data={data?.data ?? []} isLoading={solarLoading} />
          </div>
          <div className="lift rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-1" style={{ color: 'var(--fg-muted)' }}>Promedio mensual</p>
            <h3 className="text-base font-semibold tracking-tight mb-4" style={{ color: 'var(--fg)' }}>
              Distribución <span className="font-normal" style={{ color: 'var(--fg-3)' }}>· {selectedYear} (kWh/m²/día)</span>
            </h3>
            <MonthlyChart data={monthlyAggregates} isLoading={solarLoading} />
          </div>
        </section>

        {/* Irradiance Histogram 2019–2026 */}
        <section className="animate-ios-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="lift rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--accent)] font-semibold">Análisis Estadístico</p>
              <h3 className="text-xl font-semibold tracking-tight mt-0.5" style={{ color: 'var(--fg)' }}>
                Histograma de Irradiancia
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>
                Distribución de frecuencias · 2019 – 2026 · Riohacha, La Guajira
              </p>
            </div>
            <IrradianceHistogram
              latitude={mapLocation?.lat}
              longitude={mapLocation?.lng}
            />
          </div>
        </section>

        {/* ─── ANALYTICS MAP (mapcn-style) ───────────────────────────────── */}
        <section className="animate-ios-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--primary)] font-semibold">Geolocalización</p>
              <h3 className="text-xl font-semibold tracking-tight mt-0.5" style={{ color: 'var(--fg)' }}>
                Selecciona la ubicación de tu negocio
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>
                Haz clic en el mapa o busca una dirección. Los datos solares se ajustarán automáticamente.
              </p>
            </div>
            {mapLocation && (
              <span className="text-xs bg-green-900/50 border border-green-700 text-green-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-ios-pulse-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Ubicación activa
              </span>
            )}
          </div>

          {/* Big map card */}
          <div className="analytics-map mx-auto" style={{ height: 560 }}>
            <LocationPicker value={mapLocation} onChange={handleLocationChange} />

            {/* Floating coordinate badge (mapcn style) */}
            {mapLocation && (
              <div className="absolute top-4 right-4 z-[400] animate-ios-scale-in">
                <div className="glass rounded-2xl px-4 py-3 shadow-xl max-w-[320px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--fg-3)]">
                      Coordenadas
                    </span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-[var(--fg)]">
                    {mapLocation.lat.toFixed(5)}, {mapLocation.lng.toFixed(5)}
                  </p>
                  {mapLocation.address && (
                    <p className="text-[10px] text-[var(--fg-3)] mt-1 line-clamp-2 break-words">
                      {mapLocation.address}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location info row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 stagger">
            {[
              { label: 'Ciudad', value: 'Riohacha' },
              { label: 'Departamento', value: 'La Guajira' },
              { label: 'Latitud', value: mapLocation ? `${mapLocation.lat.toFixed(5)}°N` : '11.5444°N' },
              { label: 'Longitud', value: mapLocation ? `${Math.abs(mapLocation.lng).toFixed(5)}°W` : '72.9072°W' },
            ].map(({ label, value }) => (
              <div key={label} className="card-interactive rounded-2xl border px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--fg-muted)' }}>{label}</p>
                <p className="font-semibold mt-1 text-sm num" style={{ color: 'var(--fg)' }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pt-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--fg-muted)' }}>Asistente Inteligente</span>
          </div>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />
        </div>

        {/* ─── AI AGENT SECTION (below dashboard) ──────────────────────── */}
        <section id="agent-section" className="space-y-4 animate-ios-fade-up">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--accent)] font-semibold">Agente IA</p>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight mt-1" style={{ color: 'var(--fg)' }}>
              Recomendaciones Personalizadas
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--fg-3)' }}>
              Completa el perfil energético y recibe un plan solar adaptado a tu negocio.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2">
              <BusinessForm
                onSubmit={handleGenerateRecommendations}
                onLoadDemo={handleLoadDemo}
                isLoading={recLoading}
                externalLocation={mapLocation}
              />
            </div>

            <div id="recommendations-panel" className="xl:col-span-3">
              {recError && (
                <div className="bg-red-900/30 border border-red-700 rounded-2xl p-4 text-red-300 mb-4 text-sm">
                  <strong>Error:</strong> {recError}
                </div>
              )}
              <RecommendationsPanel
                recommendations={recommendations}
                isLoading={recLoading}
              />
            </div>
          </div>
        </section>

        {/* Footer spacer */}
        <div className="h-12" />
      </main>
    </div>
  );
}
