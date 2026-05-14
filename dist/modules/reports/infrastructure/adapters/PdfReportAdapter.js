"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PdfReportAdapter", {
    enumerable: true,
    get: function() {
        return PdfReportAdapter;
    }
});
const _pdfkit = /*#__PURE__*/ _interop_require_default(require("pdfkit"));
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
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const P = '#1E3A5F'; // primary navy
const A = '#F59E0B'; // accent amber
const BG = '#EFF6FF'; // light bg
const PW = 595.28; // A4 width (pt)
const PH = 841.89; // A4 height (pt)
const ML = 72; // left margin
const W = PW - ML - 72; // usable width = 451.28
// Safe Y limit: leave room for footer (36pt) + padding
const Y_MAX = PH - 60 - 44; // ~737
let PdfReportAdapter = class PdfReportAdapter {
    async generate(content) {
        return new Promise((resolve, reject)=>{
            const doc = new _pdfkit.default({
                size: 'A4',
                margins: {
                    top: 60,
                    bottom: 60,
                    left: ML,
                    right: 72
                },
                autoFirstPage: true
            });
            const chunks = [];
            doc.on('data', (c)=>chunks.push(c));
            doc.on('end', ()=>resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            // Draw footer bar — ONLY rect primitives, never changes doc.y
            const footer = ()=>{
                doc.rect(0, PH - 36, PW, 36).fill(P);
                doc.rect(0, PH - 38, PW, 2).fill(A);
            };
            // New page + footer
            const newPage = ()=>{
                doc.addPage();
                footer();
            };
            // Ensure h pixels free; page-break if needed
            const need = (h)=>{
                if (doc.y + h > Y_MAX) newPage();
            };
            // Section header bar
            const sectionBar = (title)=>{
                const y = doc.y;
                doc.rect(0, y, PW, 38).fill(P);
                doc.rect(0, y + 35, PW, 3).fill(A);
                doc.fillColor('white').fontSize(13).font('Helvetica-Bold').text(title, ML + 8, y + 12, {
                    width: W - 16,
                    lineBreak: false
                });
                doc.y = y + 52;
            };
            // ── COVER (first page — no footer) ─────────────────────────────
            doc.rect(0, 0, PW, 200).fill(P);
            doc.rect(0, 197, PW, 5).fill(A);
            // Sun circle + rays
            doc.circle(PW / 2, 76, 36).fill(A);
            for(let r = 0; r < 8; r++){
                const a = r * Math.PI / 4;
                doc.moveTo(PW / 2 + Math.cos(a) * 44, 76 + Math.sin(a) * 44).lineTo(PW / 2 + Math.cos(a) * 56, 76 + Math.sin(a) * 56).lineWidth(2.5).strokeColor(A).stroke();
            }
            doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('AGENTE SOLAR', 0, 128, {
                width: PW,
                align: 'center',
                lineBreak: false
            });
            doc.fillColor('#F0E68C').fontSize(11).font('Helvetica').text('Riohacha · La Guajira · Colombia', 0, 155, {
                width: PW,
                align: 'center',
                lineBreak: false
            });
            // Title box
            const tbY = 216;
            doc.rect(ML - 12, tbY, W + 24, 70).fill(BG);
            doc.rect(ML - 12, tbY, 5, 70).fill(A);
            doc.fillColor(P).fontSize(13).font('Helvetica-Bold').text(content.title, ML + 2, tbY + 7, {
                width: W + 12,
                lineBreak: false
            });
            doc.fillColor('#555').fontSize(10).font('Helvetica-Oblique').text(content.subtitle, ML + 2, tbY + 28, {
                width: W + 12,
                lineBreak: false
            });
            // Metadata table
            doc.y = tbY + 94;
            const meta = [
                [
                    'Ubicacion',
                    content.location
                ],
                ...content.company ? [
                    [
                        'Empresa',
                        content.company
                    ]
                ] : [],
                [
                    'Periodo',
                    `${content.period.from}  -  ${content.period.to}`
                ],
                [
                    'Generado',
                    content.generatedAt
                ]
            ];
            meta.forEach(([k, v])=>{
                const ry = doc.y;
                doc.rect(ML, ry, W, 22).fill('#F8FAFC');
                doc.rect(ML, ry, 3, 22).fill(P);
                doc.fillColor(P).fontSize(9).font('Helvetica-Bold').text(k + ':', ML + 7, ry + 6, {
                    width: W / 2 - 16,
                    lineBreak: false
                });
                doc.fillColor('#333').fontSize(9).font('Helvetica').text(v, ML + W / 2, ry + 6, {
                    width: W / 2 - 8,
                    lineBreak: false
                });
                doc.y = ry + 28;
            });
            // ── CHART PAGE ────────────────────────────────────────────────
            if (content.chartData?.labels.length) {
                newPage();
                sectionBar('Radiacion Solar Promedio Mensual (NASA POWER)');
                doc.moveDown(0.8);
                this.drawBarChart(doc, content.chartData.labels, content.chartData.values, W, ML);
                // Insight box
                const vals = content.chartData.values;
                let maxV = vals[0];
                let minV = vals[0];
                let maxI = 0;
                let minI = 0;
                vals.forEach((v, i)=>{
                    if (v > maxV) {
                        maxV = v;
                        maxI = i;
                    }
                    if (v < minV) {
                        minV = v;
                        minI = i;
                    }
                });
                const maxLbl = content.chartData.labels[maxI] ?? '';
                const minLbl = content.chartData.labels[minI] ?? '';
                need(52);
                const ky = doc.y;
                doc.rect(ML, ky, W, 46).fill(BG);
                doc.rect(ML, ky, 3, 46).fill(A);
                doc.fillColor(P).fontSize(10).font('Helvetica-Bold').text(`Mayor: ${maxLbl} (${maxV} kWh/m2/dia)   |   Menor: ${minLbl} (${minV} kWh/m2/dia)`, ML + 8, ky + 8, {
                    width: W - 16,
                    lineBreak: false
                });
                doc.fillColor('#444').fontSize(9).font('Helvetica').text('Fuente: NASA POWER API · ALLSKY_SFC_SW_DWN · Promedio mensual', ML + 8, ky + 26, {
                    width: W - 16,
                    lineBreak: false
                });
                doc.y = ky + 54;
            }
            // ── CONTENT SECTIONS ─────────────────────────────────────────
            content.sections.forEach((section)=>{
                newPage();
                sectionBar(section.title);
                if (section.keyMetrics?.length) {
                    doc.moveDown(0.4);
                    section.keyMetrics.forEach(({ label, value, unit })=>{
                        need(36);
                        const ry = doc.y;
                        doc.rect(ML, ry, W, 30).fill(BG);
                        doc.rect(ML, ry, 4, 30).fill(A);
                        doc.fillColor('#555').fontSize(9).font('Helvetica').text(label, ML + 8, ry + 4, {
                            width: W / 2,
                            lineBreak: false
                        });
                        doc.fillColor(P).fontSize(13).font('Helvetica-Bold').text(`${value}${unit ? '  ' + unit : ''}`, ML, ry + 8, {
                            width: W - 8,
                            align: 'right',
                            lineBreak: false
                        });
                        doc.y = ry + 36;
                    });
                    doc.moveDown(0.3);
                }
                if (section.paragraphs?.length) {
                    section.paragraphs.forEach((p)=>{
                        need(40);
                        doc.fillColor('#222').fontSize(11).font('Helvetica').text(p, ML, doc.y, {
                            width: W,
                            align: 'justify'
                        });
                        doc.moveDown(0.4);
                    });
                }
                if (section.table) {
                    need(30);
                    this.drawTable(doc, section.table.headers, section.table.rows, W, ML, Y_MAX, newPage);
                }
            });
            // ── RECOMMENDATIONS ───────────────────────────────────────────
            if (content.recommendations.length) {
                newPage();
                sectionBar('Recomendaciones');
                doc.moveDown(0.4);
                content.recommendations.forEach((rec, i)=>{
                    need(32);
                    const bY = doc.y;
                    doc.rect(ML, bY, 24, 24).fill(A);
                    doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text(`${i + 1}`, ML, bY + 5, {
                        width: 24,
                        align: 'center',
                        lineBreak: false
                    });
                    doc.fillColor('#222').fontSize(10.5).font('Helvetica').text(rec, ML + 30, bY + 5, {
                        width: W - 30,
                        lineBreak: false
                    });
                    doc.y = Math.max(doc.y, bY + 30);
                    doc.moveDown(0.3);
                });
            }
            // ── CONCLUSION ────────────────────────────────────────────────
            if (content.conclusion) {
                newPage();
                sectionBar('Conclusion Ejecutiva');
                doc.moveDown(0.4);
                need(50);
                const cY = doc.y;
                doc.rect(ML, cY, 4, 180).fill(A);
                doc.fillColor('#222').fontSize(11).font('Helvetica').text(content.conclusion, ML + 10, cY, {
                    width: W - 10,
                    align: 'justify'
                });
            }
            doc.end();
        });
    }
    // ─────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────
    drawBarChart(doc, labels, values, W, ML) {
        const CHART_H = 155;
        const YLW = 38; // Y-axis label width
        const BX = ML + YLW; // bars start X
        const BW = W - YLW; // bars area width
        const CY = doc.y; // chart top Y
        const N = labels.length;
        if (N === 0) return;
        // max value (no spread operator — iterative to avoid stack issues)
        let maxV = values[0];
        values.forEach((v)=>{
            if (v > maxV) maxV = v;
        });
        maxV *= 1.18;
        const slotW = BW / N;
        const barW = Math.min(slotW * 0.66, 26);
        const barOff = (slotW - barW) / 2;
        // Chart background
        doc.rect(BX, CY, BW, CHART_H).fill('#F8FAFC');
        // Grid + Y labels
        for(let i = 0; i <= 5; i++){
            const yf = i / 5;
            const ly = CY + CHART_H - yf * CHART_H;
            if (i > 0) {
                doc.moveTo(BX, ly).lineTo(BX + BW, ly).lineWidth(0.3).strokeColor('#D0D8E4').stroke();
            }
            doc.fillColor('#666').fontSize(7).font('Helvetica').text((maxV * yf).toFixed(1), ML, ly - 4, {
                width: YLW - 4,
                align: 'right',
                lineBreak: false
            });
        }
        // Bars
        values.forEach((v, i)=>{
            const bh = Math.max(2, v / maxV * CHART_H);
            const bx = BX + i * slotW + barOff;
            const by = CY + CHART_H - bh;
            doc.rect(bx, by, barW, bh).fill(P);
            doc.rect(bx, by, barW, Math.min(bh, 5)).fill(A);
            doc.fillColor(P).fontSize(6).font('Helvetica-Bold').text(v.toFixed(1), bx - 2, by - 9, {
                width: barW + 4,
                align: 'center',
                lineBreak: false
            });
            doc.fillColor('#444').fontSize(6).font('Helvetica').text(labels[i], bx - 3, CY + CHART_H + 3, {
                width: barW + 6,
                align: 'center',
                lineBreak: false
            });
        });
        // Axes
        doc.moveTo(BX, CY).lineTo(BX, CY + CHART_H).lineWidth(1).strokeColor('#888').stroke();
        doc.moveTo(BX, CY + CHART_H).lineTo(BX + BW, CY + CHART_H).lineWidth(1).stroke();
        doc.y = CY + CHART_H + 24;
    }
    drawTable(doc, headers, rows, width, ML, yMax, newPage) {
        const colW = width / headers.length;
        let y = doc.y;
        // Header row
        doc.rect(ML, y, width, 24).fill(A);
        headers.forEach((h, i)=>{
            doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(h, ML + i * colW + 4, y + 7, {
                width: colW - 8,
                align: 'center',
                lineBreak: false
            });
        });
        y += 24;
        // Data rows
        rows.forEach((row, ri)=>{
            if (y > yMax) {
                newPage();
                y = 80;
            }
            doc.rect(ML, y, width, 19).fill(ri % 2 === 0 ? '#F0F4F8' : 'white');
            doc.moveTo(ML, y + 19).lineTo(ML + width, y + 19).lineWidth(0.3).strokeColor('#DDD').stroke();
            row.forEach((cell, ci)=>{
                doc.fillColor('#222').fontSize(9).font('Helvetica').text(String(cell), ML + ci * colW + 4, y + 4, {
                    width: colW - 8,
                    align: typeof cell === 'number' ? 'right' : 'left',
                    lineBreak: false
                });
            });
            y += 19;
        });
        doc.y = y + 10;
    }
    constructor(){
        _define_property(this, "mimeType", 'application/pdf');
        _define_property(this, "fileExtension", 'pdf');
    }
};

//# sourceMappingURL=PdfReportAdapter.js.map