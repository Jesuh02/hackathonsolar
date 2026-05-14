import axios from 'axios';
import {
  CompanyProfile,
  CompanySearchResponse,
  CompanyEnergyHistoryEntry,
  RegistryCompanyResult,
  UpsertCompanyRequest,
} from '@/types/company.types';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  timeout: 15000,
});

const SOCRATA_URL = 'https://www.datos.gov.co/resource/9cku-k5ps.json';

/**
 * Search companies by name.
 * Sources (run in parallel):
 *  1. Local Next.js API route (/api/companies/search) → Supabase directly (server-side)
 *  2. Railway backend (/api/companies/search) → Supabase via backend (fallback)
 *  3. datos.gov.co Socrata API → official registry
 */
export async function searchRegistryCompanies(
  name: string,
  municipio = 'RIOHACHA',
  ano = '2026',
): Promise<RegistryCompanyResult[]> {
  // Escape single-quotes to prevent injection into the $where clause
  const safeName = name.toUpperCase().replace(/'/g, "''");

  const [localSavedResult, remoteSavedResult, registryResult] = await Promise.allSettled([
    // ── 1. Local Next.js API route → Supabase (company_profiles + business_profiles) ──
    axios.get<CompanySearchResponse>('/api/companies/search', {
      params: { name },
      timeout: 8_000,
    }),
    // ── 2. Railway backend → Supabase saved companies (fallback) ─────────────────────
    apiClient.get<CompanySearchResponse>('/api/companies/search', {
      params: { name, municipio, ano },
      timeout: 8_000,
    }),
    // ── 3. Direct browser → datos.gov.co (no deploy needed, open CORS) ──────────────
    axios.get<Record<string, string>[]>(SOCRATA_URL, {
      params: {
        municipio: municipio.toUpperCase(),
        ano,
        '$where': `upper(razon_social_establecimiento) like '%${safeName}%'`,
        '$limit': 50,
      },
      timeout: 10_000,
    }),
  ]);

  const results: RegistryCompanyResult[] = [];
  const savedNames = new Set<string>();

  // Prefer local Next.js API results; fall back to Railway backend results
  const savedSource =
    localSavedResult.status === 'fulfilled' && (localSavedResult.value.data.results?.length ?? 0) > 0
      ? localSavedResult
      : remoteSavedResult;

  if (savedSource.status === 'fulfilled') {
    for (const r of savedSource.value.data.results ?? []) {
      if (r.source === 'saved') {
        results.push(r);
        savedNames.add(r.name.toLowerCase());
      }
    }
  }

  // Registry results from datos.gov.co (deduplicated against saved names)
  if (registryResult.status === 'fulfilled') {
    const raw = Array.isArray(registryResult.value.data) ? registryResult.value.data : [];
    for (const item of raw.slice(0, 15)) {
      const label = (item.razon_social_establecimiento ?? '').trim();
      if (!label || savedNames.has(label.toLowerCase())) continue;
      results.push({
        name: label,
        municipio: item.municipio ?? '',
        categoria: item.categoria ?? '',
        source: 'registry',
        rawData: item,
      });
    }
  }

  return results;
}

/**
 * Fetch a previously saved company profile from Supabase by name.
 * Tries local Next.js API route first (direct Supabase), then Railway backend.
 * Returns null if not found in either source.
 */
export async function getCompanyByName(name: string): Promise<CompanyProfile | null> {
  const encoded = encodeURIComponent(name);

  // Try local Next.js API route first (direct Supabase access)
  try {
    const { data } = await axios.get<CompanyProfile>(`/api/companies/${encoded}`, {
      timeout: 8_000,
    });
    return data;
  } catch (localErr: unknown) {
    if (axios.isAxiosError(localErr) && localErr.response?.status === 404) return null;
    // Local route unavailable or error — fall through to Railway backend
  }

  // Fallback: Railway backend
  try {
    const { data } = await apiClient.get<CompanyProfile>(`/api/companies/${encoded}`);
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Fetch the energy consumption history for a company (most recent first).
 */
export async function getCompanyHistory(name: string): Promise<CompanyEnergyHistoryEntry[]> {
  try {
    const { data } = await apiClient.get<CompanyEnergyHistoryEntry[]>(
      `/api/companies/${encodeURIComponent(name)}/history`,
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Insert or update (upsert) a company profile in Supabase.
 * Also appends a snapshot to company_energy_history.
 */
export async function upsertCompany(profile: UpsertCompanyRequest): Promise<CompanyProfile> {
  const { data } = await apiClient.put<CompanyProfile>('/api/companies', profile);
  return data;
}
