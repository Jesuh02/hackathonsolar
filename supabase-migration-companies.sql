-- Migration: company_profiles + company_energy_history tables
-- Stores energy profile data for companies (not tied to WhatsApp phone)

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: Newer Supabase projects (2024+) revoke public schema grants by default.
-- Re-grant the minimum required privileges so PostgREST can see the tables.
-- ─────────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.company_profiles (
  id                          uuid             NOT NULL DEFAULT gen_random_uuid(),
  company_name                text             NOT NULL,
  business_type               text             NOT NULL DEFAULT 'hotel',
  address                     text,
  latitude                    double precision,
  longitude                   double precision,
  monthly_consumption_kwh     double precision NOT NULL DEFAULT 0,
  peak_demand_kw              double precision NOT NULL DEFAULT 0,
  operating_hours_per_day     integer          NOT NULL DEFAULT 8,
  electricity_rate_cop_per_kwh double precision NOT NULL DEFAULT 750,
  has_solar_panels            boolean          NOT NULL DEFAULT false,
  solar_capacity_kw           double precision,
  has_battery_storage         boolean          NOT NULL DEFAULT false,
  battery_capacity_kwh        double precision,
  is_registry_company         boolean          NOT NULL DEFAULT false,
  created_at                  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at                  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT company_profiles_name_unique UNIQUE (company_name)
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_company_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_profiles_updated_at ON public.company_profiles;
CREATE TRIGGER trg_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_company_profiles_updated_at();

-- Enable Row Level Security (recommended for Supabase)
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- Allow service role (backend) full access
CREATE POLICY "service_role_all" ON public.company_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Explicit table-level grants (required for PostgREST schema cache)
GRANT ALL ON public.company_profiles TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: company_energy_history table
-- Immutable audit log — every save/update appends a new row, never overwrites.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_energy_history (
  id                          uuid             NOT NULL DEFAULT gen_random_uuid(),
  company_name                text             NOT NULL,
  monthly_consumption_kwh     double precision NOT NULL,
  peak_demand_kw              double precision NOT NULL,
  operating_hours_per_day     integer          NOT NULL,
  electricity_rate_cop_per_kwh double precision NOT NULL DEFAULT 750,
  has_solar_panels            boolean          NOT NULL DEFAULT false,
  solar_capacity_kw           double precision,
  has_battery_storage         boolean          NOT NULL DEFAULT false,
  battery_capacity_kwh        double precision,
  latitude                    double precision,
  longitude                   double precision,
  notes                       text,
  recorded_at                 timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_energy_history_pkey PRIMARY KEY (id)
);

-- Index for fast lookups by company name
CREATE INDEX IF NOT EXISTS idx_energy_history_company_name
  ON public.company_energy_history (company_name);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_energy_history_recorded_at
  ON public.company_energy_history (recorded_at DESC);

ALTER TABLE public.company_energy_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_history" ON public.company_energy_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Explicit table-level grants (required for PostgREST schema cache)
GRANT ALL ON public.company_energy_history TO service_role;
