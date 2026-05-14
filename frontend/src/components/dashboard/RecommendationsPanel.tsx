'use client';

import {
  RecommendationsResponse,
  RecommendationItem,
  PRIORITY_COLORS,
  CATEGORY_ICONS,
  CONFIDENCE_BADGE,
  IMPACT_TYPE_BADGE,
} from '@/types/recommendations.types';

interface RecommendationsPanelProps {
  recommendations: RecommendationsResponse | null;
  isLoading: boolean;
}

function LoadingState() {
  return (
    <div className="rounded-xl border p-6 space-y-4 animate-pulse"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="h-6 rounded w-2/3" style={{ background: 'var(--surface-3)' }} />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg" style={{ background: 'var(--surface-3)' }} />)}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 rounded-lg" style={{ background: 'var(--surface-3)' }} />
      ))}
      <p className="text-center text-sm pt-2" style={{ color: 'var(--fg-3)' }}>
        🤖 El Agente Solar está analizando datos...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border p-12 text-center"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <span className="text-6xl block mb-4">🌞</span>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--fg)' }}>Agente Solar listo</h3>
      <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--fg-2)' }}>
        Ingresa el perfil energético de tu empresa o carga un demo para recibir
        recomendaciones personalizadas de ahorro.
      </p>
    </div>
  );
}

function CapexBlock({ capex }: { capex: NonNullable<RecommendationItem['capex']> }) {
  const paybackYears = (capex.paybackMonths / 12).toFixed(1);
  return (
    <div className="mt-2 rounded p-2 text-xs space-y-1"
      style={{ background: 'color-mix(in srgb, var(--primary) 6%, var(--surface))', border: '1px solid color-mix(in srgb, var(--primary) 25%, var(--border))' }}>
      <p className="font-semibold" style={{ color: 'var(--primary)' }}>📦 CAPEX estimado</p>
      <div className="flex gap-4 flex-wrap">
        <span style={{ color: 'var(--fg-2)' }}>
          Inversión: <strong style={{ color: 'var(--fg)' }}>
            {(capex.minCop / 1_000_000).toFixed(1)}–{(capex.maxCop / 1_000_000).toFixed(1)} M COP
          </strong>
        </span>
        <span style={{ color: 'var(--fg-2)' }}>
          Payback: <strong style={{ color: 'var(--fg)' }}>{capex.paybackMonths} meses ({paybackYears} años)</strong>
        </span>
      </div>
    </div>
  );
}

function ScenariosBlock({ scenarios }: { scenarios: NonNullable<RecommendationItem['scenarios']> }) {
  return (
    <div className="mt-2 rounded p-2 text-xs"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="font-semibold mb-1.5" style={{ color: 'var(--fg-2)' }}>📈 Escenarios de ahorro</p>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { key: 'conservador', label: 'Conservador', color: 'var(--fg-3)' },
          { key: 'realista',    label: 'Realista',    color: 'var(--primary)' },
          { key: 'optimista',   label: 'Optimista',   color: '#22c55e' },
        ].map(({ key, label, color }) => (
          <div key={key} className="rounded p-1.5 text-center"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--fg-3)' }}>{label}</p>
            <p className="font-medium text-xs mt-0.5 break-words" style={{ color }}>
              {scenarios[key as keyof typeof scenarios]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssumptionsBlock({ assumptions }: { assumptions: string[] }) {
  return (
    <div className="mt-2 rounded p-2 text-xs"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--fg-2)' }}>📋 Supuestos</p>
      <ul className="space-y-0.5">
        {assumptions.map((a, i) => (
          <li key={i} style={{ color: 'var(--fg-3)' }}>• {a}</li>
        ))}
      </ul>
    </div>
  );
}

export function RecommendationsPanel({ recommendations: rec, isLoading }: RecommendationsPanelProps) {
  if (isLoading) return <LoadingState />;
  if (!rec) return <EmptyState />;

  const scoreColorValue =
    rec.energyScore >= 70 ? 'var(--success)' :
    rec.energyScore >= 40 ? 'var(--accent)' : 'var(--danger)';

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="border-b p-6"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--surface)), color-mix(in srgb, var(--accent) 8%, var(--surface)))',
          borderColor: 'var(--border)',
        }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{rec.businessName}</h2>
            <p className="text-sm capitalize mt-0.5" style={{ color: 'var(--fg-2)' }}>{rec.businessType}</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--fg-3)' }}>Puntuación energética</p>
            <p className="text-3xl font-bold" style={{ color: scoreColorValue }}>{rec.energyScore}<span className="text-lg">/100</span></p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ahorro estimado', value: `${rec.estimatedMonthlySavingsKwh} kWh`, sub: 'por mes', color: '#22c55e' },
            { label: 'En dinero', value: rec.estimatedMonthlySavingsCop.toLocaleString('es-CO'), sub: 'COP/mes', color: '#22c55e' },
            { label: 'Radiación solar', value: String(rec.solarContext.averageIrradiance), sub: 'kWh/m²/día', color: 'var(--primary)' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-lg p-3 text-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
              <p className="font-bold text-sm" style={{ color }}>{value}</p>
              <p className="text-xs" style={{ color: 'var(--fg-3)' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Location */}
        <div className="rounded-lg p-3"
          style={{ background: 'color-mix(in srgb, var(--primary) 8%, var(--surface-2))', border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--border))' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--info-fg)' }}>📍 Ubicación usada para el análisis solar</p>
          <p className="font-mono text-xs" style={{ color: 'var(--info-fg-2)' }}>
            {rec.solarContext.analysedLocation.lat.toFixed(5)},&nbsp;
            {rec.solarContext.analysedLocation.lng.toFixed(5)}
          </p>
          {rec.solarContext.analysedLocation.address && (
            <p className="text-xs mt-1 break-words" style={{ color: 'var(--info-fg-2)' }}>
              {rec.solarContext.analysedLocation.address}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: 'var(--info-fg-3)' }}>
            <span>Nivel: <strong style={{ color: 'var(--info-fg-4)' }}>{rec.solarContext.radiationLevel}</strong></span>
            <span>·</span>
            <span>Potencial: <strong style={{ color: 'var(--info-fg-4)' }}>{rec.solarContext.solarPotentialKwhPerDay} kWh/día</strong></span>
          </div>
        </div>

        {/* Datetime + solar condition */}
        {(rec.solarContext.analysisDatetime || rec.solarContext.solarCondition) && (
          <div className="rounded-lg p-3 space-y-1"
            style={{ background: 'color-mix(in srgb, var(--accent) 8%, var(--surface-2))', border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))' }}>
            {rec.solarContext.analysisDatetime && (
              <p className="text-xs" style={{ color: 'var(--warn-fg)' }}>
                🕐 <span className="font-medium">{rec.solarContext.analysisDatetime}</span>
              </p>
            )}
            {rec.solarContext.solarCondition && (
              <p className="text-xs" style={{ color: 'var(--warn-fg-2)' }}>
                ☀️ Condición solar: <span className="font-semibold" style={{ color: 'var(--warn-fg-3)' }}>{rec.solarContext.solarCondition}</span>
              </p>
            )}
          </div>
        )}

        {/* Recommendations list */}
        <div>
          <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--fg-2)' }}>
            Recomendaciones ({rec.recommendations.length})
          </h3>
          <div className="space-y-4">
            {rec.recommendations.map((item, index) => {
              const confidence = CONFIDENCE_BADGE[item.confidenceLevel as keyof typeof CONFIDENCE_BADGE];
              const impact = IMPACT_TYPE_BADGE[item.impactType as keyof typeof IMPACT_TYPE_BADGE];
              return (
                <div key={index} className="rounded-lg p-4 border transition-colors"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 flex-shrink-0">
                      {CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS]}
                    </span>
                    <div className="flex-1 min-w-0">
                      {/* Badge row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${PRIORITY_COLORS[item.priority as keyof typeof PRIORITY_COLORS]}`}>
                          {item.priority}
                        </span>
                        <span className="text-xs capitalize" style={{ color: 'var(--fg-3)' }}>{item.category}</span>
                        {impact && (
                          <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
                            {impact.icon} {impact.label}
                          </span>
                        )}
                        {confidence && (
                          <span className={`text-xs px-2 py-0.5 rounded border ${confidence.color}`}>
                            {confidence.label}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{item.title}</h4>
                      <p className="text-xs mt-1" style={{ color: 'var(--fg-2)' }}>{item.description}</p>

                      {/* Benchmark */}
                      {item.benchmark && (
                        <div className="mt-2 rounded px-2 py-1 text-xs"
                          style={{ background: 'color-mix(in srgb, var(--info) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--info) 25%, var(--border))' }}>
                          🏢 <span style={{ color: 'var(--info-fg)' }}>{item.benchmark}</span>
                        </div>
                      )}

                      {/* Assumptions */}
                      {item.assumptions && item.assumptions.length > 0 && (
                        <AssumptionsBlock assumptions={item.assumptions} />
                      )}

                      {/* Action */}
                      <div className="mt-2 p-2 rounded text-xs"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <span className="font-medium" style={{ color: 'var(--fg-2)' }}>Acción: </span>
                        <span style={{ color: 'var(--fg)' }}>{item.action}</span>
                      </div>

                      {/* Impact */}
                      <p className="text-xs mt-1 font-medium" style={{ color: '#22c55e' }}>
                        💰 {item.estimatedImpact}
                      </p>

                      {/* Formula */}
                      {item.savingsCalculationExplanation && (
                        <p className="text-xs mt-1 font-mono rounded px-2 py-1"
                          style={{ color: 'var(--fg-3)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          📐 {item.savingsCalculationExplanation}
                        </p>
                      )}

                      {/* CAPEX + ROI */}
                      {item.capex && <CapexBlock capex={item.capex} />}

                      {/* Scenarios */}
                      {item.scenarios && <ScenariosBlock scenarios={item.scenarios} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-center" style={{ color: 'var(--fg-3)' }}>
          Generado el {new Date(rec.generatedAt).toLocaleString('es-CO')} •
          Modelo: Qwen3 via OpenRouter
        </p>
      </div>
    </div>
  );
}
