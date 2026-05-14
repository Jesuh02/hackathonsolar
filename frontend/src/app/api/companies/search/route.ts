import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/companies/search?name=XXX
 * Server-side route: searches company_profiles AND business_profiles in Supabase.
 * This supplements the Railway backend when its Supabase connection is unavailable.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get('name') ?? '').trim();

  if (name.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    // Env vars not set — return empty so the frontend falls back to Railway
    return NextResponse.json({ results: [], total: 0 });
  }

  const [companySettled, businessSettled] = await Promise.allSettled([
    supabase
      .from('company_profiles')
      .select('company_name, address, business_type')
      .ilike('company_name', `%${name}%`)
      .limit(10),
    supabase
      .from('business_profiles')
      .select('business_name, address, business_type')
      .ilike('business_name', `%${name}%`)
      .limit(10),
  ]);

  type SearchResult = {
    name: string;
    municipio: string;
    source: 'saved' | 'registry';
    rawData: Record<string, string>;
  };

  const results: SearchResult[] = [];
  const seenNames = new Set<string>();

  // company_profiles first
  if (companySettled.status === 'fulfilled' && companySettled.value.data) {
    for (const c of companySettled.value.data) {
      if (!c.company_name) continue;
      results.push({
        name: c.company_name as string,
        municipio: (c.address as string | null) ?? 'Riohacha',
        source: 'saved',
        rawData: { business_type: c.business_type as string },
      });
      seenNames.add((c.company_name as string).toLowerCase());
    }
  }

  // business_profiles (WhatsApp companies — deduplicated)
  if (businessSettled.status === 'fulfilled' && businessSettled.value.data) {
    for (const b of businessSettled.value.data) {
      const bname = b.business_name as string;
      if (!bname || seenNames.has(bname.toLowerCase())) continue;
      results.push({
        name: bname,
        municipio: (b.address as string | null) ?? 'Riohacha',
        source: 'saved',
        rawData: { business_type: b.business_type as string },
      });
    }
  }

  return NextResponse.json({ results, total: results.length });
}
