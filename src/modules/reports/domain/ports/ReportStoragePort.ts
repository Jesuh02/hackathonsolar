import { Result } from '@shared/domain/Result';

export interface StoreReportRequest {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  phone?: string;
}

export interface StoredReport {
  key: string;
  url: string;
}

export interface ReportStoragePort {
  store(request: StoreReportRequest): Promise<Result<StoredReport>>;
}