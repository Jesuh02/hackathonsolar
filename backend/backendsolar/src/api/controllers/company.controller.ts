import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { getSupabaseClient } from '../../shared/infrastructure/SupabaseClient';

const DATOS_GOV_CO_URL = 'https://www.datos.gov.co/resource/9cku-k5ps.json';

const upsertSchema = z.object({
  companyName: z.string().min(2, 'Nombre requerido'),
  businessType: z.enum(['hotel', 'hielera', 'retail', 'oficina', 'industrial']),
  monthlyConsumptionKwh: z.number().positive(),
  peakDemandKw: z.number().positive(),
  operatingHoursPerDay: z.number().min(1).max(24),
  electricityRateCopPerKwh: z.number().positive().default(750),
  hasSolarPanels: z.boolean(),
  solarCapacityKw: z.number().positive().optional(),
  hasBatteryStorage: z.boolean(),
  batteryCapacityKwh: z.number().positive().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      address: z.string().optional(),
    })
    .optional(),
  isRegistryCompany: z.boolean().default(false),
  notes: z.string().optional(),
});

export class CompanyController {
  /**
   * GET /api/companies/search?name=XXX&municipio=RIOHACHA&ano=2026
   * Merges results from datos.gov.co registry AND Supabase saved companies.
   */
  async searchRegistry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const name = ((req.query.name as string) ?? '').trim();
      const municipio = ((req.query.municipio as string) ?? 'RIOHACHA').trim().toUpperCase();
      const ano = (req.query.ano as string) ?? '2026';

      if (!name || name.length < 2) {
        res.status(400).json({ error: 'El parámetro "name" debe tener al menos 2 caracteres' });
        return;
      }

      // Sanitise for Socrata $where (escape single quotes to prevent injection into external API)
      // The dataset field is razon_social_establecimiento (verified against the real API schema)
      const safeNameUpper = name.toUpperCase().replace(/'/g, "''");

      // Run datos.gov.co + both Supabase tables in parallel.
      // Wrap Supabase calls in Promise.resolve().then() so a synchronous throw
      // (e.g. missing env vars) is still caught by Promise.allSettled.
      const [registrySettled, savedSettled, businessSettled] = await Promise.allSettled([
        axios.get<Record<string, string>[]>(DATOS_GOV_CO_URL, {
          params: {
            municipio,
            ano,
            '$where': `upper(razon_social_establecimiento) like '%${safeNameUpper}%'`,
            '$limit': 50,
          },
          timeout: 10000,
        }),
        // company_profiles: saved via the web form
        Promise.resolve().then(() =>
          getSupabaseClient()
            .from('company_profiles')
            .select('company_name, address, business_type')
            .ilike('company_name', `%${name}%`)
            .limit(10),
        ),
        // business_profiles: saved via the WhatsApp agent (e.g. Panadería Don Humberto)
        Promise.resolve().then(() =>
          getSupabaseClient()
            .from('business_profiles')
            .select('business_name, address, business_type')
            .ilike('business_name', `%${name}%`)
            .limit(10),
        ),
      ]);

      // ── Saved companies (Supabase) ────────────────────────────────────
      type SearchResult = { name: string; municipio: string; categoria?: string; source: 'registry' | 'saved'; rawData: Record<string, string> };
      const savedResults: SearchResult[] = [];

      // From company_profiles (web form)
      if (savedSettled.status === 'fulfilled' && savedSettled.value.data) {
        for (const c of savedSettled.value.data) {
          savedResults.push({
            name: c.company_name as string,
            municipio: (c.address as string | null) ?? 'Riohacha',
            source: 'saved',
            rawData: { business_type: c.business_type as string },
          });
        }
      }

      // From business_profiles (WhatsApp agent)
      if (businessSettled.status === 'fulfilled' && businessSettled.value.data) {
        const existingNames = new Set(savedResults.map((r) => r.name.toLowerCase()));
        for (const b of businessSettled.value.data) {
          const bname = b.business_name as string;
          if (!bname || existingNames.has(bname.toLowerCase())) continue;
          savedResults.push({
            name: bname,
            municipio: (b.address as string | null) ?? 'Riohacha',
            source: 'saved',
            rawData: { business_type: b.business_type as string },
          });
        }
      }

      // ── Registry companies (datos.gov.co) ─────────────────────────────
      // The name field is razon_social_establecimiento (NOT nombre_comercial)
      const registryResults: SearchResult[] = [];
      if (registrySettled.status === 'fulfilled') {
        const raw = Array.isArray(registrySettled.value.data) ? registrySettled.value.data : [];
        for (const item of raw.slice(0, 15)) {
          const label = (item.razon_social_establecimiento ?? '').trim();
          if (!label) continue;
          registryResults.push({
            name: label,
            municipio: item.municipio ?? '',
            categoria: item.categoria ?? item.sub_categoria ?? '',
            source: 'registry',
            rawData: item,
          });
        }
      }

      // Merge: saved first, then registry entries not already saved
      const savedNames = new Set(savedResults.map((s) => s.name.toLowerCase()));
      const uniqueRegistry = registryResults.filter(
        (r) => !savedNames.has(r.name.toLowerCase()),
      );
      const results = [...savedResults, ...uniqueRegistry];

      res.json({ results, total: results.length });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/companies/:name
   * Retrieve a previously saved company profile from Supabase.
   * Checks company_profiles first, then falls back to business_profiles
   * (used by the WhatsApp agent).
   */
  async getByName(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const name = decodeURIComponent((req.params.name as string) ?? '').trim();
      if (!name) {
        res.status(400).json({ error: 'Nombre requerido' });
        return;
      }

      const supabase = getSupabaseClient();

      // 1. Try company_profiles (web form)
      const { data: cp, error: cpErr } = await supabase
        .from('company_profiles')
        .select('*')
        .ilike('company_name', name)
        .maybeSingle();

      if (cpErr) throw cpErr;

      if (cp) {
        res.json(cp);
        return;
      }

      // 2. Fallback: business_profiles (WhatsApp agent — e.g. Panadería Don Humberto)
      const { data: bp, error: bpErr } = await supabase
        .from('business_profiles')
        .select('*')
        .ilike('business_name', name)
        .maybeSingle();

      if (bpErr) throw bpErr;

      if (bp) {
        // Normalise business_profiles shape to match company_profiles response
        const normalised = {
          company_name: bp.business_name,
          business_type: bp.business_type,
          address: bp.address ?? null,
          latitude: bp.latitude ?? null,
          longitude: bp.longitude ?? null,
          monthly_consumption_kwh: bp.monthly_consumption_kwh,
          peak_demand_kw: bp.peak_demand_kw,
          operating_hours_per_day: bp.operating_hours_per_day,
          electricity_rate_cop_per_kwh: bp.electricity_rate_cop_per_kwh,
          has_solar_panels: bp.has_solar_panels,
          solar_capacity_kw: null,
          has_battery_storage: bp.has_battery_storage,
          battery_capacity_kwh: null,
          is_registry_company: false,
          _source_table: 'business_profiles',
        };
        res.json(normalised);
        return;
      }

      res.status(404).json({ error: 'Empresa no encontrada' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/companies/:name/history
   * Returns the energy consumption history for a company (most recent first).
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const name = decodeURIComponent((req.params.name as string) ?? '').trim();
      if (!name) {
        res.status(400).json({ error: 'Nombre requerido' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('company_energy_history')
        .select('*')
        .ilike('company_name', name)
        .order('recorded_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      res.json(data ?? []);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/companies
   * Insert or update a company profile (upsert by company_name) AND
   * appends a snapshot to company_energy_history for auditing.
   */
  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = upsertSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'Datos inválidos', details: parsed.error.flatten() });
        return;
      }

      const d = parsed.data;
      const supabase = getSupabaseClient();

      const profileRow = {
        company_name: d.companyName,
        business_type: d.businessType,
        monthly_consumption_kwh: d.monthlyConsumptionKwh,
        peak_demand_kw: d.peakDemandKw,
        operating_hours_per_day: d.operatingHoursPerDay,
        electricity_rate_cop_per_kwh: d.electricityRateCopPerKwh,
        has_solar_panels: d.hasSolarPanels,
        solar_capacity_kw: d.solarCapacityKw ?? null,
        has_battery_storage: d.hasBatteryStorage,
        battery_capacity_kwh: d.batteryCapacityKwh ?? null,
        address: d.location?.address ?? null,
        latitude: d.location?.lat ?? null,
        longitude: d.location?.lng ?? null,
        is_registry_company: d.isRegistryCompany,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('company_profiles')
        .upsert(profileRow, { onConflict: 'company_name' })
        .select()
        .single();

      if (error) throw error;

      // Append to history (non-blocking — never fail the main request)
      const historyRow = {
        company_name: d.companyName,
        monthly_consumption_kwh: d.monthlyConsumptionKwh,
        peak_demand_kw: d.peakDemandKw,
        operating_hours_per_day: d.operatingHoursPerDay,
        electricity_rate_cop_per_kwh: d.electricityRateCopPerKwh,
        has_solar_panels: d.hasSolarPanels,
        has_battery_storage: d.hasBatteryStorage,
        solar_capacity_kw: d.solarCapacityKw ?? null,
        battery_capacity_kwh: d.batteryCapacityKwh ?? null,
        latitude: d.location?.lat ?? null,
        longitude: d.location?.lng ?? null,
        notes: d.notes ?? null,
      };
      supabase.from('company_energy_history').insert(historyRow).then(({ error: hErr }) => {
        if (hErr) console.warn('[companies] history insert failed:', hErr.message);
      });

      res.json(data);
    } catch (error) {
      next(error);
    }
  }
}
