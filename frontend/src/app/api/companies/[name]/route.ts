import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/companies/[name]
 * Server-side route: fetch a company profile by name from Supabase.
 * Checks company_profiles first, then falls back to business_profiles.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { name: string } },
) {
  const name = decodeURIComponent(params.name ?? '').trim();

  if (!name) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 });
  }

  // 1. Try company_profiles
  const { data: cp } = await supabase
    .from('company_profiles')
    .select('*')
    .ilike('company_name', name)
    .maybeSingle();

  if (cp) {
    return NextResponse.json(cp);
  }

  // 2. Fallback: business_profiles (WhatsApp companies)
  const { data: bp } = await supabase
    .from('business_profiles')
    .select('*')
    .ilike('business_name', name)
    .maybeSingle();

  if (bp) {
    // Normalise to match company_profiles shape
    return NextResponse.json({
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
    });
  }

  return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
}
