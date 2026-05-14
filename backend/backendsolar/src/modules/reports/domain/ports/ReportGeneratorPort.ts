export interface ReportSection {
  title: string;
  paragraphs?: string[];
  table?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
  keyMetrics?: Array<{ label: string; value: string | number; unit?: string }>;
}

/** Monthly solar-radiation series for chart rendering */
export interface ChartData {
  labels: string[];   // e.g. ["Ene '24", "Feb '24", ...]
  values: number[];   // avg kWh/m²/día per month
  title?: string;
}

export interface ReportContent {
  title: string;
  subtitle: string;
  generatedAt: string;
  period: { from: string; to: string };
  location: string;
  company?: string;
  sections: ReportSection[];
  recommendations: string[];
  conclusion: string;
  /** Optional chart data injected by GenerateReportUseCase */
  chartData?: ChartData;
}

export type ReportFormat = 'excel' | 'pdf' | 'word';

export interface GenerateReportRequest {
  query: string;
  format: ReportFormat;
  startDate?: string; // YYYYMMDD
  endDate?: string;   // YYYYMMDD
}

export interface GenerateReportResponse {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Port for report generation adapters (Excel / PDF / Word)
 */
export interface ReportGeneratorPort {
  generate(content: ReportContent): Promise<Buffer>;
  readonly mimeType: string;
  readonly fileExtension: string;
}
