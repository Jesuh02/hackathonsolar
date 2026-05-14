'use client';

import { useState } from 'react';
import { reportsApi } from '@/lib/api/whatsapp.api';

interface Props {
  onClose: () => void;
}

type Format = 'excel' | 'pdf' | 'word';

const FORMAT_CONFIG: Record<Format, { label: string; icon: string; mime: string }> = {
  pdf:   { label: 'PDF',   icon: '📄', mime: 'application/pdf' },
  excel: { label: 'Excel', icon: '📊', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  word:  { label: 'Word',  icon: '📝', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
};

const EXAMPLE_QUERIES = [
  'Reporte de datos históricos de radiación solar en Riohacha',
  'Análisis de estacionalidad de irradiancia solar 2024-2025',
  'Informe de potencial fotovoltaico para Riohacha, La Guajira',
  'Reporte mensual de radiación solar y comparativa anual',
];

export function ReportGeneratorModal({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<Format>('pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    if (query.trim().length < 5) { setError('Describe qué reporte quieres generar'); return; }
    setError('');
    setLoading(true);
    setProgress('Consultando datos de NASA POWER...');

    try {
      setTimeout(() => setProgress('Analizando con inteligencia artificial...'), 3000);
      setTimeout(() => setProgress('Generando archivo profesional...'), 8000);

      const blob = await reportsApi.generate(query.trim(), format);
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf';
      const filename = `reporte-solar-riohacha-${Date.now()}.${ext}`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress('');
      setLoading(false);
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al generar el reporte. Intenta de nuevo.';
      setError(msg);
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-6 py-4 flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <div>
            <h2 className="text-white font-bold text-lg">Generador de Reportes</h2>
            <p className="text-blue-200 text-xs">Datos NASA POWER + IA · Riohacha, La Guajira</p>
          </div>
          <button onClick={onClose} className="ml-auto text-blue-200 hover:text-white text-xl font-bold leading-none" disabled={loading}>×</button>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Query */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">¿Qué reporte necesitas?</label>
            <textarea
              placeholder="Ej: Genera un reporte de datos históricos de radiación solar en Riohacha"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          {/* Example queries */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Ejemplos:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  disabled={loading}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full border border-gray-700 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">Formato de salida</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FORMAT_CONFIG) as Format[]).map((f) => {
                const cfg = FORMAT_CONFIG[f];
                return (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    disabled={loading}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                      format === f
                        ? 'border-blue-500 bg-blue-900/30 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{cfg.icon}</span>
                    <span className="text-xs font-semibold">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}

          {loading && progress && (
            <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-800 rounded-lg px-4 py-3">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-blue-300 text-sm">{progress}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || query.trim().length < 5}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando reporte...
              </>
            ) : (
              `${FORMAT_CONFIG[format].icon} Generar reporte ${FORMAT_CONFIG[format].label}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
