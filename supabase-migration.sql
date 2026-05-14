-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.business_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  business_name text NOT NULL,
  business_type text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL DEFAULT 11.5444,
  longitude double precision NOT NULL DEFAULT '-72.9072'::numeric,
  monthly_consumption_kwh double precision NOT NULL DEFAULT 0,
  peak_demand_kw double precision NOT NULL DEFAULT 0,
  operating_hours_per_day integer NOT NULL DEFAULT 8,
  electricity_rate_cop_per_kwh double precision NOT NULL DEFAULT 750,
  has_solar_panels boolean NOT NULL DEFAULT false,
  has_battery_storage boolean NOT NULL DEFAULT false,
  daily_recommendations_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT business_profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);