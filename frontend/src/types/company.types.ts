export interface CompanyProfile {
  id?: string;
  company_name: string;
  business_type: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  monthly_consumption_kwh: number;
  peak_demand_kw: number;
  operating_hours_per_day: number;
  electricity_rate_cop_per_kwh: number;
  has_solar_panels: boolean;
  solar_capacity_kw?: number | null;
  has_battery_storage: boolean;
  battery_capacity_kwh?: number | null;
  is_registry_company: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RegistryCompanyResult {
  name: string;
  municipio: string;
  /** Categoria from datos.gov.co (e.g. "ESTABLECIMIENTOS DE ALOJAMIENTO...") */
  categoria?: string;
  /** 'saved' = previously stored in Supabase; 'registry' = from datos.gov.co */
  source: 'registry' | 'saved';
  rawData: Record<string, string>;
}

export interface CompanySearchResponse {
  results: RegistryCompanyResult[];
  total: number;
}

export interface UpsertCompanyRequest {
  companyName: string;
  businessType: string;
  monthlyConsumptionKwh: number;
  peakDemandKw: number;
  operatingHoursPerDay: number;
  electricityRateCopPerKwh: number;
  hasSolarPanels: boolean;
  solarCapacityKw?: number;
  hasBatteryStorage: boolean;
  batteryCapacityKwh?: number;
  location?: { lat: number; lng: number; address?: string };
  isRegistryCompany: boolean;
  notes?: string;
}

export interface CompanyEnergyHistoryEntry {
  id: string;
  company_name: string;
  monthly_consumption_kwh: number;
  peak_demand_kw: number;
  operating_hours_per_day: number;
  electricity_rate_cop_per_kwh: number;
  has_solar_panels: boolean;
  solar_capacity_kw?: number | null;
  has_battery_storage: boolean;
  battery_capacity_kwh?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  recorded_at: string;
}
