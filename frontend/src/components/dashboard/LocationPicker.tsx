'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { Map, MapControls, MapMarker, MarkerContent, useMap } from '@/components/ui/map';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SelectedLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface LocationPickerProps {
  value: SelectedLocation | null;
  onChange: (loc: SelectedLocation) => void;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// ─── Geocoding helpers ────────────────────────────────────────────────────────
const NOMINATIM_VIEWBOX = '-72.960,11.500,-72.850,11.580';

function normaliseColombianAddress(raw: string): string {
  return raw
    .replace(/\bcr\.?\s*/gi, 'carrera ')
    .replace(/\bcl\.?\s*/gi, 'calle ')
    .replace(/\bav\.?\s*/gi, 'avenida ')
    .replace(/\bdiag\.?\s*/gi, 'diagonal ')
    .replace(/\btrans\.?\s*/gi, 'transversal ')
    .replace(/#/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function geocodeAddress(query: string): Promise<NominatimResult[]> {
  const normalised = normaliseColombianAddress(query);
  const q = encodeURIComponent(`${normalised}, Riohacha, La Guajira, Colombia`);
  const url =
    `https://nominatim.openstreetmap.org/search?q=${q}` +
    `&format=json&limit=5&addressdetails=1` +
    `&viewbox=${NOMINATIM_VIEWBOX}&bounded=0&countrycodes=co`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AgenteSolar/1.0 (hackathon-solar)' },
  });
  if (!res.ok) return [];
  return res.json() as Promise<NominatimResult[]>;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'AgenteSolar/1.0 (hackathon-solar)' } }
    );
    if (!res.ok) return undefined;
    const data: { display_name?: string } = await res.json() as { display_name?: string };
    return data.display_name;
  } catch {
    return undefined;
  }
}

// ─── Inner click handler — must live inside <Map> to use useMap() ────────────
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lngLat: { lng: number; lat: number }) => void;
}) {
  const { map } = useMap();
  const cbRef = useRef(onMapClick);
  cbRef.current = onMapClick;

  useEffect(() => {
    if (!map) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      cbRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    map.on('click', handler);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = '';
    };
  }, [map]);

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMapClick = useCallback(
    async ({ lng, lat }: { lng: number; lat: number }) => {
      onChange({ lat, lng });
      const address = await reverseGeocode(lat, lng);
      if (address) onChange({ lat, lng, address });
    },
    [onChange]
  );

  const handleSearchInput = useCallback((raw: string) => {
    setSearchQuery(raw);
    setSearchError('');
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (raw.trim().length < 3) return;
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geocodeAddress(raw);
        setSuggestions(results);
        if (results.length === 0)
          setSearchError('Sin resultados. Prueba con más detalles.');
      } catch {
        setSearchError('Error al buscar la dirección.');
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const pickSuggestion = useCallback(
    (s: NominatimResult) => {
      const lat = parseFloat(s.lat);
      const lng = parseFloat(s.lon);
      setSuggestions([]);
      setSearchQuery(s.display_name);
      onChange({ lat, lng, address: s.display_name });
    },
    [onChange]
  );

  const handleSearchSubmit = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setSuggestions([]);
    try {
      const results = await geocodeAddress(searchQuery);
      if (results.length > 0) {
        pickSuggestion(results[0]);
      } else {
        setSearchError('Sin resultados. Prueba con más detalles.');
      }
    } catch {
      setSearchError('Error al buscar la dirección.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, pickSuggestion]);

  return (
    <div className="relative h-full w-full">
      {/* Map */}
      <Map center={[-72.905, 11.540]} zoom={13}>
        <MapClickHandler onMapClick={handleMapClick} />
        {value && (
          <MapMarker longitude={value.lng} latitude={value.lat}>
            <MarkerContent>
              <div
                style={{
                  width: 36, height: 36,
                  borderRadius: '50% 50% 50% 0',
                  background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                  border: '3px solid white',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                  transform: 'rotate(-45deg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ transform: 'rotate(45deg)', fontSize: 14 }}>☀️</span>
              </div>
            </MarkerContent>
          </MapMarker>
        )}
        <MapControls />
      </Map>

      {/* Floating search bar */}
      <div className="absolute top-4 left-4 z-10 w-[min(420px,calc(100%-72px))]">
        <div className="relative">
          <div
            className="flex gap-2 rounded-2xl p-1.5 shadow-xl"
            style={{
              background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); }
                }}
                placeholder="Buscar dirección · Ej: Cr 14a #28-26"
                style={{ color: 'var(--fg)', background: 'transparent' }}
                className="w-full border-0 px-3 py-2 text-sm placeholder:text-[var(--fg-muted)] focus:outline-none pr-8"
              />
              {isSearching && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin inline-block" />
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearchSubmit}
              disabled={isSearching || !searchQuery.trim()}
              className="tactile px-3 py-2 bg-[var(--primary)] hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm"
            >
              🔍
            </button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <ul
              className="absolute z-50 w-full mt-2 rounded-2xl shadow-xl overflow-hidden animate-ios-scale-in"
              style={{
                background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border)',
              }}
            >
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    style={{ color: 'var(--fg-2)' }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-[var(--surface-2)] border-b border-[var(--border)] last:border-0 transition-colors"
                  >
                    <span className="text-[var(--primary)] mr-1">📍</span>
                    {s.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchError && (
            <p
              className="absolute top-full mt-1.5 left-2 text-xs px-2 py-1 rounded-lg"
              style={{
                color: '#f59e0b',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              {searchError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
