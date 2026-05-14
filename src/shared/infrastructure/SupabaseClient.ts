import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

/** Business profile stored in Supabase */
export interface BusinessProfile {
  id: string;
  phone: string;              // E.164 without +, e.g. "573053048316"
  business_name: string;
  business_type: string;      // 'hotel' | 'hielera' | 'retail' | 'oficina' | 'industrial'
  address: string;
  latitude: number;
  longitude: number;
  monthly_consumption_kwh: number;
  peak_demand_kw: number;
  operating_hours_per_day: number;
  electricity_rate_cop_per_kwh: number;
  has_solar_panels: boolean;
  has_battery_storage: boolean;
  daily_recommendations_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Single LLM conversation turn stored in Supabase */
export interface ConversationRow {
  id?: string;
  phone: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

let instance: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client using the service role key.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    const url = process.env.SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required');
    }
    instance = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { transport: ws },
    });
  }
  return instance;
}
