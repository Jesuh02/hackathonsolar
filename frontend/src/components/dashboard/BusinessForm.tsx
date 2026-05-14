'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GenerateRecommendationsRequest,
  BusinessType,
  BUSINESS_TYPE_LABELS,
  BusinessLocation,
} from '@/types/recommendations.types';
import {
  searchRegistryCompanies,
  getCompanyByName,
  getCompanyHistory,
  upsertCompany,
} from '@/lib/api/companies.api';
import type { RegistryCompanyResult, CompanyEnergyHistoryEntry } from '@/types/company.types';
import type { SelectedLocation } from './LocationPicker';

interface BusinessFormProps {
  onSubmit: (request: GenerateRecommendationsRequest) => Promise<void>;
  onLoadDemo: (type: BusinessType) => Promise<void>;
  isLoading: boolean;
  externalLocation?: SelectedLocation | null;
}

const defaultValues: GenerateRecommendationsRequest = {
  businessName: '',
  businessType: 'hotel',
  monthlyConsumptionKwh: 5000,
  peakDemandKw: 20,
  operatingHoursPerDay: 12,
  hasSolarPanels: false,
  hasBatteryStorage: false,
  electricityRateCopPerKwh: 750,
  analysisDatetime: new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16),
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

export function BusinessForm({ onSubmit, onLoadDemo, isLoading, externalLocation }: BusinessFormProps) {
  const [form, setForm] = useState<GenerateRecommendationsRequest>(defaultValues);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Company search / autocomplete ──────────────────────────────────────
  const [searchResults, setSearchResults] = useState<RegistryCompanyResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRegistryCompany, setIsRegistryCompany] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // ── Energy history ─────────────────────────────────────────────────────
  const [history, setHistory] = useState<CompanyEnergyHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── Save status ────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(<K extends keyof GenerateRecommendationsRequest>(
    key: K,
    value: GenerateRecommendationsRequest[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Sync external (dashboard map) location into form.location
  useEffect(() => {
    if (externalLocation) {
      setForm((prev) => ({
        ...prev,
        location: {
          lat: externalLocation.lat,
          lng: externalLocation.lng,
          address: externalLocation.address,
        } as BusinessLocation,
      }));
    }
  }, [externalLocation]);

  // ── Debounced search: registry + Supabase saved companies ─────────────
  useEffect(() => {
    const name = form.businessName.trim();

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (name.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchRegistryCompanies(name);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [form.businessName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Fetch energy history for a company ────────────────────────────────
  const fetchHistory = useCallback(async (name: string) => {
    if (!name.trim()) { setHistory([]); return; }
    setHistoryLoading(true);
    try {
      const rows = await getCompanyHistory(name.trim());
      setHistory(rows);
      if (rows.length > 0) setShowHistory(true);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /**
   * Load a saved Supabase profile for the given name and populate the form.
   * Also fetches the energy history.
   */
  const loadSavedProfile = useCallback(async (name: string, fromRegistry: boolean) => {
    setIsRegistryCompany(fromRegistry);
    setProfileLoaded(false);
    setHistory([]);
    setShowHistory(false);

    if (!name.trim()) return;

    // Fetch profile and history in parallel
    const [profile] = await Promise.all([
      getCompanyByName(name.trim()).catch(() => null),
      fetchHistory(name),
    ]);

    if (profile) {
      setForm((prev) => ({
        ...prev,
        businessName: profile.company_name,
        businessType: profile.business_type as BusinessType,
        monthlyConsumptionKwh: profile.monthly_consumption_kwh,
        peakDemandKw: profile.peak_demand_kw,
        operatingHoursPerDay: profile.operating_hours_per_day,
        electricityRateCopPerKwh: profile.electricity_rate_cop_per_kwh,
        hasSolarPanels: profile.has_solar_panels,
        solarCapacityKw: profile.solar_capacity_kw ?? undefined,
        hasBatteryStorage: profile.has_battery_storage,
        batteryCapacityKwh: profile.battery_capacity_kwh ?? undefined,
        location:
          profile.latitude != null && profile.longitude != null
            ? { lat: profile.latitude, lng: profile.longitude, address: profile.address ?? undefined }
            : prev.location,
      }));
      setProfileLoaded(true);
    }
  }, [fetchHistory]);

  const handleSelectFromDropdown = useCallback(
    async (result: RegistryCompanyResult) => {
      setShowDropdown(false);
      update('businessName', result.name);
      // source='saved' means it's in Supabase; isRegistryCompany = it also exists in datos.gov.co
      await loadSavedProfile(result.name, result.source === 'registry');
    },
    [update, loadSavedProfile],
  );

  const handleNameBlur = useCallback(async () => {
    setShowDropdown(false);
    const name = form.businessName.trim();
    if (name.length < 2) return;

    const exactMatch = searchResults.find(
      (r) => r.name.toLowerCase() === name.toLowerCase(),
    );
    const fromRegistry = exactMatch?.source === 'registry' || (!!exactMatch && exactMatch.source !== 'saved');
    await loadSavedProfile(name, fromRegistry);
  }, [form.businessName, searchResults, loadSavedProfile]);

  const sanitizeRequest = useCallback(
    (request: GenerateRecommendationsRequest): GenerateRecommendationsRequest | null => {
      const businessName = request.businessName.trim();
      const requiredNumbers = [
        request.monthlyConsumptionKwh,
        request.peakDemandKw,
        request.operatingHoursPerDay,
        request.electricityRateCopPerKwh,
      ];

      if (businessName.length < 2) {
        setFormError('Ingresa un nombre de empresa válido.');
        return null;
      }

      if (requiredNumbers.some((value) => !Number.isFinite(value) || value <= 0)) {
        setFormError('Revisa los campos numéricos requeridos.');
        return null;
      }

      const sanitized: GenerateRecommendationsRequest = {
        businessName,
        businessType: request.businessType,
        monthlyConsumptionKwh: request.monthlyConsumptionKwh,
        peakDemandKw: request.peakDemandKw,
        operatingHoursPerDay: request.operatingHoursPerDay,
        hasSolarPanels: request.hasSolarPanels,
        hasBatteryStorage: request.hasBatteryStorage,
        electricityRateCopPerKwh: request.electricityRateCopPerKwh,
      };

      if (request.analysisDatetime?.trim()) sanitized.analysisDatetime = request.analysisDatetime;

      if (request.location && Number.isFinite(request.location.lat) && Number.isFinite(request.location.lng)) {
        sanitized.location = request.location;
      }
      if (request.hasSolarPanels && Number.isFinite(request.solarCapacityKw)) {
        sanitized.solarCapacityKw = request.solarCapacityKw;
      }
      if (request.hasBatteryStorage && Number.isFinite(request.batteryCapacityKwh)) {
        sanitized.batteryCapacityKwh = request.batteryCapacityKwh;
      }

      setFormError(null);
      return sanitized;
    },
    [],
  );

  // ── Shared upsert helper ───────────────────────────────────────────────
  const doUpsert = useCallback(
    async (sanitized: GenerateRecommendationsRequest): Promise<boolean> => {
      try {
        await upsertCompany({
          companyName: sanitized.businessName,
          businessType: sanitized.businessType,
          monthlyConsumptionKwh: sanitized.monthlyConsumptionKwh,
          peakDemandKw: sanitized.peakDemandKw,
          operatingHoursPerDay: sanitized.operatingHoursPerDay,
          electricityRateCopPerKwh: sanitized.electricityRateCopPerKwh,
          hasSolarPanels: sanitized.hasSolarPanels,
          solarCapacityKw: sanitized.solarCapacityKw,
          hasBatteryStorage: sanitized.hasBatteryStorage,
          batteryCapacityKwh: sanitized.batteryCapacityKwh,
          location: sanitized.location,
          isRegistryCompany,
        });
        return true;
      } catch {
        return false;
      }
    },
    [isRegistryCompany],
  );

  // ── Save-only ──────────────────────────────────────────────────────────
  const handleSaveOnly = async () => {
    const sanitized = sanitizeRequest(form);
    if (!sanitized) return;

    setSaveStatus('saving');
    const ok = await doUpsert(sanitized);
    setSaveStatus(ok ? 'saved' : 'error');
    if (ok) {
      setProfileLoaded(true);
      // Refresh history after save
      await fetchHistory(sanitized.businessName);
    }
  };

  // ── Submit: save + generate ────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeRequest(form);
    if (!sanitized) return;

    setSaveStatus('saving');
    const ok = await doUpsert(sanitized);
    setSaveStatus(ok ? 'saved' : 'error');
    if (ok) {
      setProfileLoaded(true);
      void fetchHistory(sanitized.businessName);
    }
    await onSubmit(sanitized);
  };

  // ── Styles ─────────────────────────────────────────────────────────────
  const inputClass =
    'w-full border rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-0';
  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--fg)' };
  const labelClass = 'block text-xs font-semibold mb-1.5 uppercase tracking-wide';
  const labelStyle = { color: 'var(--fg-3)' };

  // Split dropdown results by source for grouped display
  const savedResults = searchResults.filter((r) => r.source === 'saved');
  const registryResults = searchResults.filter((r) => r.source === 'registry');

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--fg)' }}>🏢 Perfil Energético</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>
          Ingresa los datos de tu empresa para recibir recomendaciones del Agente Solar
        </p>
      </div>

      {/* Demo buttons */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--fg-muted)' }}>Demo rápido</p>
        <div className="flex gap-2 flex-wrap">
          {(['hotel', 'hielera', 'retail'] as BusinessType[]).map((type) => (
            <button
              key={type}
              onClick={() => onLoadDemo(type)}
              disabled={isLoading}
              className="tactile px-3.5 py-1.5 rounded-xl text-xs font-semibold border capitalize disabled:opacity-40"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--fg-2)' }}
            >
              {type === 'hotel' ? '🏨' : type === 'hielera' ? '🧊' : '🛒'} {type}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {/* ── Company name with unified autocomplete ───────────────────── */}
        <div ref={dropdownRef} className="relative">
          <label className={labelClass} style={labelStyle}>Nombre de la empresa *</label>
          <div className="relative">
            <input
              type="text"
              className={inputClass}
              style={inputStyle}
              placeholder="Ej: Hotel Almirante Padilla"
              value={form.businessName}
              onChange={(e) => {
                update('businessName', e.target.value);
                setProfileLoaded(false);
                setHistory([]);
                setShowHistory(false);
                setSaveStatus('idle');
              }}
              onBlur={handleNameBlur}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              autoComplete="off"
              required
            />
            {searchLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Grouped autocomplete dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div
              className="absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <ul className="max-h-64 overflow-y-auto divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                {/* Saved companies group */}
                {savedResults.length > 0 && (
                  <>
                    <li
                      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest sticky top-0"
                      style={{ background: 'rgba(34,197,94,0.08)', color: 'rgb(22,163,74)', borderBottom: '1px solid var(--border)' }}
                    >
                      🗄️ Guardadas en sistema
                    </li>
                    {savedResults.map((r, i) => (
                      <li key={`saved-${i}`}>
                        <button
                          type="button"
                          className="w-full text-left px-3.5 py-2.5 text-sm transition-colors"
                          style={{ color: 'var(--fg)', background: 'transparent' }}
                          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectFromDropdown(r);
                          }}
                        >
                          <span className="font-medium">{r.name}</span>
                          <span
                            className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.15)', color: 'rgb(22,163,74)' }}
                          >
                            ✓ guardada
                          </span>
                        </button>
                      </li>
                    ))}
                  </>
                )}

                {/* Registry companies group */}
                {registryResults.length > 0 && (
                  <>
                    <li
                      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest sticky top-0"
                      style={{ background: 'rgba(59,130,246,0.08)', color: 'rgb(37,99,235)', borderBottom: '1px solid var(--border)' }}
                    >
                      📋 Registro oficial · datos.gov.co
                    </li>
                    {registryResults.map((r, i) => (
                      <li key={`reg-${i}`}>
                        <button
                          type="button"
                          className="w-full text-left px-3.5 py-2.5 text-sm transition-colors"
                          style={{ color: 'var(--fg)', background: 'transparent' }}
                          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectFromDropdown(r);
                          }}
                        >
                          <span className="font-medium">{r.name}</span>
                          {r.categoria && (
                            <span className="block text-[10px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                              {r.categoria}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </div>
          )}

          {/* Status badges below the input */}
          {form.businessName.trim().length > 1 && !showDropdown && (
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {profileLoaded && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.12)', color: 'rgb(22,163,74)' }}>
                  ✅ Datos anteriores cargados
                </span>
              )}
              {isRegistryCompany && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.12)', color: 'rgb(37,99,235)' }}>
                  📋 Registro oficial
                </span>
              )}
              {!isRegistryCompany && !profileLoaded && form.businessName.trim().length > 1 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.12)', color: 'rgb(180,83,9)' }}>
                  🆕 Empresa nueva
                </span>
              )}
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory((s) => !s)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-opacity hover:opacity-75"
                  style={{ background: 'rgba(139,92,246,0.12)', color: 'rgb(109,40,217)' }}
                >
                  📊 {history.length} registro{history.length !== 1 ? 's' : ''} de historial {showHistory ? '▲' : '▼'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Business type ─────────────────────────────────────────────── */}
        <div>
          <label className={labelClass} style={labelStyle}>Tipo de negocio</label>
          <select className={inputClass} style={inputStyle} value={form.businessType}
            onChange={(e) => update('businessType', e.target.value as BusinessType)}>
            {(Object.entries(BUSINESS_TYPE_LABELS) as [BusinessType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* ── Consumption & demand ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Consumo mensual (kWh)</label>
            <input type="number" className={inputClass} style={inputStyle} min={100}
              value={form.monthlyConsumptionKwh}
              onChange={(e) => update('monthlyConsumptionKwh', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Demanda pico (kW)</label>
            <input type="number" className={inputClass} style={inputStyle} min={1}
              value={form.peakDemandKw}
              onChange={(e) => update('peakDemandKw', parseFloat(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Horas operación/día</label>
            <input type="number" className={inputClass} style={inputStyle} min={1} max={24}
              value={form.operatingHoursPerDay}
              onChange={(e) => update('operatingHoursPerDay', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Tarifa (COP/kWh)</label>
            <input type="number" className={inputClass} style={inputStyle} min={100}
              value={form.electricityRateCopPerKwh}
              onChange={(e) => update('electricityRateCopPerKwh', parseFloat(e.target.value))} />
          </div>
        </div>

        {/* ── Solar & battery ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-solar-500"
              checked={form.hasSolarPanels}
              onChange={(e) => {
                const checked = e.target.checked;
                update('hasSolarPanels', checked);
                if (!checked) update('solarCapacityKw', undefined);
              }} />
            <span className="text-sm" style={{ color: 'var(--fg-2)' }}>☀️ Tiene paneles solares</span>
          </label>
          {form.hasSolarPanels && (
            <div>
              <label className={labelClass} style={labelStyle}>Capacidad solar (kW)</label>
              <input type="number" className={inputClass} style={inputStyle} min={0.5}
                value={form.solarCapacityKw ?? ''}
                onChange={(e) => update('solarCapacityKw', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                placeholder="Ej: 10" />
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-solar-500"
              checked={form.hasBatteryStorage}
              onChange={(e) => {
                const checked = e.target.checked;
                update('hasBatteryStorage', checked);
                if (!checked) update('batteryCapacityKwh', undefined);
              }} />
            <span className="text-sm" style={{ color: 'var(--fg-2)' }}>🔋 Tiene almacenamiento en baterías</span>
          </label>
          {form.hasBatteryStorage && (
            <div>
              <label className={labelClass} style={labelStyle}>Capacidad baterías (kWh)</label>
              <input type="number" className={inputClass} style={inputStyle} min={1}
                value={form.batteryCapacityKwh ?? ''}
                onChange={(e) => update('batteryCapacityKwh', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                placeholder="Ej: 20" />
            </div>
          )}
        </div>

        {/* ── Validation error ──────────────────────────────────────────── */}
        {formError && (
          <div className="rounded-xl border px-3.5 py-2.5 text-sm"
            style={{ borderColor: 'rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.07)', color: 'var(--danger)' }}>
            {formError}
          </div>
        )}

        {/* ── Location badge ────────────────────────────────────────────── */}
        <div className="rounded-xl border px-3.5 py-2.5 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          {externalLocation || form.location ? (
            <div className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">📍</span>
              <div className="flex-1 min-w-0">
                <p className="font-mono" style={{ color: 'var(--fg-2)' }}>
                  {(externalLocation?.lat ?? form.location?.lat)?.toFixed(5)},{' '}
                  {(externalLocation?.lng ?? form.location?.lng)?.toFixed(5)}
                </p>
                {(externalLocation?.address ?? form.location?.address) && (
                  <p className="mt-0.5 break-words" style={{ color: 'var(--fg-3)' }}>
                    {externalLocation?.address ?? form.location?.address}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--accent)' }}>
              📍 Selecciona una ubicación en el mapa de arriba para mayor precisión (opcional)
            </p>
          )}
        </div>

        {/* ── Analysis datetime ─────────────────────────────────────────── */}
        <div>
          <label className={labelClass} style={labelStyle}>🕐 Fecha y hora del análisis</label>
          <input type="datetime-local" className={inputClass} style={inputStyle}
            value={form.analysisDatetime ?? ''}
            max={new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16)}
            onChange={(e) => update('analysisDatetime', e.target.value)} />
          <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
            Las recomendaciones varían según la hora — paneles activos entre las 6h y 18h
          </p>
        </div>

        {/* ── Save status banners ───────────────────────────────────────── */}
        {saveStatus === 'saved' && (
          <div className="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.07)', color: 'rgb(22,163,74)' }}>
            ✅ Perfil de empresa guardado en Supabase
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.07)', color: 'rgb(180,83,9)' }}>
            ⚠️ No se pudo guardar el perfil en Supabase. Verifica la conexión e intenta de nuevo.
          </div>
        )}

        {/* ── Save-only button ──────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSaveOnly}
          disabled={saveStatus === 'saving' || !form.businessName.trim()}
          className="tactile w-full py-2.5 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 border disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--fg-2)' }}
        >
          {saveStatus === 'saving' ? (
            <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Guardando empresa...</>
          ) : (
            <>💾 {profileLoaded ? 'Actualizar datos de empresa' : 'Guardar empresa'}</>
          )}
        </button>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={isLoading || saveStatus === 'saving' || !form.businessName.trim()}
          className="tactile w-full py-3 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}
        >
          {isLoading ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando recomendaciones...</>
          ) : '🤖 Generar Recomendaciones'}
        </button>
      </form>

      {/* ── Energy history panel ──────────────────────────────────────────── */}
      {(historyLoading || history.length > 0) && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold transition-opacity hover:opacity-75"
            style={{ color: 'var(--fg-2)' }}
            onClick={() => setShowHistory((s) => !s)}
          >
            <span className="flex items-center gap-2">
              📊 Historial de consumo energético
              {historyLoading && (
                <span className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              )}
              {!historyLoading && history.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'rgb(109,40,217)' }}>
                  {history.length}
                </span>
              )}
            </span>
            <span>{showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && history.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              {history.map((entry, i) => {
                const isFirst = i === 0;
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl p-3.5 border"
                    style={{
                      borderColor: isFirst ? 'rgba(139,92,246,0.3)' : 'var(--border)',
                      background: isFirst ? 'rgba(139,92,246,0.05)' : 'var(--surface-2)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--fg-3)' }}>
                        {fmtDate(entry.recorded_at)}
                      </span>
                      {isFirst && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(139,92,246,0.15)', color: 'rgb(109,40,217)' }}>
                          más reciente
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span style={{ color: 'var(--fg-muted)' }}>Consumo mensual</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                        {entry.monthly_consumption_kwh.toLocaleString('es-CO')} kWh
                      </span>
                      <span style={{ color: 'var(--fg-muted)' }}>Demanda pico</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                        {entry.peak_demand_kw} kW
                      </span>
                      <span style={{ color: 'var(--fg-muted)' }}>Horas operación</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                        {entry.operating_hours_per_day} h/día
                      </span>
                      <span style={{ color: 'var(--fg-muted)' }}>Tarifa</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                        ${entry.electricity_rate_cop_per_kwh.toLocaleString('es-CO')}/kWh
                      </span>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {entry.has_solar_panels && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(234,179,8,0.15)', color: 'rgb(161,98,7)' }}>
                          ☀️ Solar{entry.solar_capacity_kw ? ` ${entry.solar_capacity_kw}kW` : ''}
                        </span>
                      )}
                      {entry.has_battery_storage && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(59,130,246,0.15)', color: 'rgb(29,78,216)' }}>
                          🔋 Batería{entry.battery_capacity_kwh ? ` ${entry.battery_capacity_kwh}kWh` : ''}
                        </span>
                      )}
                      {entry.latitude != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(5,150,105)' }}>
                          📍 {entry.latitude?.toFixed(4)}, {entry.longitude?.toFixed(4)}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="mt-1.5 text-xs italic" style={{ color: 'var(--fg-muted)' }}>{entry.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
