import { Request, Response, NextFunction } from 'express';
import { GenerateReportUseCase } from '../../modules/reports/application/use-cases/GenerateReportUseCase';
import { ReportFormat } from '../../modules/reports/domain/ports/ReportGeneratorPort';
import { z } from 'zod';

const reportSchema = z.object({
  query: z.string().min(5, 'La consulta debe tener al menos 5 caracteres'),
  format: z.enum(['excel', 'pdf', 'word']).default('pdf'),
  startDate: z.string().regex(/^\d{8}$/, 'Formato YYYYMMDD requerido').optional(),
  endDate: z.string().regex(/^\d{8}$/, 'Formato YYYYMMDD requerido').optional(),
});

export class ReportsController {
  constructor(private readonly generateReport: GenerateReportUseCase) {}

  /** POST /api/reports/generate */
  async handleGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Parámetros inválidos', details: parsed.error.flatten() });
        return;
      }

      const result = await this.generateReport.execute({
        query: parsed.data.query,
        format: parsed.data.format as ReportFormat,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      });

      if (result.isFailure) {
        res.status(502).json({ error: result.error });
        return;
      }

      const { buffer, filename, mimeType } = result.value;
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  }
}
