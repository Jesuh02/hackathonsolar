"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ReportsController", {
    enumerable: true,
    get: function() {
        return ReportsController;
    }
});
const _zod = require("zod");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
const reportSchema = _zod.z.object({
    query: _zod.z.string().min(5, 'La consulta debe tener al menos 5 caracteres'),
    format: _zod.z.enum([
        'excel',
        'pdf',
        'word'
    ]).default('pdf'),
    startDate: _zod.z.string().regex(/^\d{8}$/, 'Formato YYYYMMDD requerido').optional(),
    endDate: _zod.z.string().regex(/^\d{8}$/, 'Formato YYYYMMDD requerido').optional()
});
let ReportsController = class ReportsController {
    /** POST /api/reports/generate */ async handleGenerate(req, res, next) {
        try {
            const parsed = reportSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Parámetros inválidos',
                    details: parsed.error.flatten()
                });
                return;
            }
            const result = await this.generateReport.execute({
                query: parsed.data.query,
                format: parsed.data.format,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate
            });
            if (result.isFailure) {
                res.status(502).json({
                    error: result.error
                });
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
    constructor(generateReport){
        _define_property(this, "generateReport", void 0);
        this.generateReport = generateReport;
    }
};

//# sourceMappingURL=reports.controller.js.map