import { createHash, randomUUID } from 'crypto';
import axios from 'axios';
import { Result } from '@shared/domain/Result';
import {
  ReportStoragePort,
  StoreReportRequest,
  StoredReport,
} from '../../domain/ports/ReportStoragePort';

const aws4 = require('aws4');

interface CloudflareR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export class CloudflareR2ReportStorageAdapter implements ReportStoragePort {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly endpoint: URL;

  constructor(config: CloudflareR2Config) {
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl.replace(/\/$/, '');
    this.endpoint = new URL(`https://${config.accountId}.r2.cloudflarestorage.com`);
  }

  async store(request: StoreReportRequest): Promise<Result<StoredReport>> {
    if (!this.accessKeyId || !this.secretAccessKey || !this.bucketName || !this.publicUrl) {
      return Result.fail('Cloudflare R2 upload failed: configuración R2 incompleta.');
    }

    const key = this.buildObjectKey(request);
    const path = `/${this.bucketName}/${key}`;
    const payloadHash = createHash('sha256').update(request.buffer).digest('hex');

    try {
      const signedRequest = aws4.sign({
        host: this.endpoint.host,
        method: 'PUT',
        path,
        service: 's3',
        region: 'auto',
        headers: {
          'Content-Disposition': `attachment; filename="${request.filename}"`,
          'Content-Length': String(request.buffer.length),
          'Content-Type': request.mimeType,
          'X-Amz-Content-Sha256': payloadHash,
        },
        body: request.buffer,
      }, {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });

      await axios.put(`${this.endpoint.origin}${path}`, request.buffer, {
        headers: signedRequest.headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return Result.ok({
        key,
        url: `${this.publicUrl}/${key}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(`Cloudflare R2 upload failed: ${message}`);
    }
  }

  private buildObjectKey(request: StoreReportRequest): string {
    const ext = request.filename.includes('.') ? request.filename.split('.').pop() : 'bin';
    const safePhone = (request.phone ?? 'unknown').replace(/[^0-9a-zA-Z_-]/g, '');
    return [
      'reports',
      safePhone || 'unknown',
      `${Date.now()}-${randomUUID()}.${ext}`,
    ].join('/');
  }
}