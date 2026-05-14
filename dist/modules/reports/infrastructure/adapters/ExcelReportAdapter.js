"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ExcelReportAdapter", {
    enumerable: true,
    get: function() {
        return ExcelReportAdapter;
    }
});
const _exceljs = /*#__PURE__*/ _interop_require_default(require("exceljs"));
const _ChartImageService = require("../services/ChartImageService");
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
const HEADER_COLOR = '1E3A5F';
const ACCENT_COLOR = 'F59E0B';
const ALT_ROW_COLOR = 'F0F4F8';
let ExcelReportAdapter = class ExcelReportAdapter {
    async generate(content) {
        // Pre-fetch chart + map images
        const [chartBuf, mapBuf] = await Promise.all([
            content.chartData ? this.chartService.getBarChartPng(content.chartData.labels, content.chartData.values, content.chartData.title ?? 'Radiación Solar Promedio Mensual (kWh/m²/día)') : Promise.resolve(null),
            this.chartService.getRiohachaMapPng()
        ]);
        const workbook = new _exceljs.default.Workbook();
        workbook.creator = 'Agente Solar – Riohacha, La Guajira';
        workbook.created = new Date();
        workbook.modified = new Date();
        // ── Cover sheet ──────────────────────────────────────────────────────────
        const cover = workbook.addWorksheet('Portada', {
            pageSetup: {
                paperSize: 9,
                orientation: 'portrait'
            }
        });
        // Header banner row
        cover.mergeCells('A1:H1');
        cover.getCell('A1').value = '☀ AGENTE SOLAR – RIOHACHA, LA GUAJIRA, COLOMBIA';
        cover.getCell('A1').style = {
            font: {
                bold: true,
                size: 18,
                color: {
                    argb: 'FFFFFFFF'
                }
            },
            alignment: {
                horizontal: 'center',
                vertical: 'middle'
            },
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: `FF${HEADER_COLOR}`
                }
            }
        };
        cover.getRow(1).height = 52;
        // Accent stripe
        cover.mergeCells('A2:H2');
        cover.getCell('A2').style = {
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: `FF${ACCENT_COLOR}`
                }
            }
        };
        cover.getRow(2).height = 5;
        // Title
        cover.mergeCells('A3:H3');
        cover.getCell('A3').value = content.title;
        cover.getCell('A3').style = {
            font: {
                bold: true,
                size: 16,
                color: {
                    argb: `FF${HEADER_COLOR}`
                }
            },
            alignment: {
                horizontal: 'center',
                vertical: 'middle'
            }
        };
        cover.getRow(3).height = 38;
        // Subtitle
        cover.mergeCells('A4:H4');
        cover.getCell('A4').value = content.subtitle;
        cover.getCell('A4').style = {
            font: {
                italic: true,
                size: 12,
                color: {
                    argb: 'FF555555'
                }
            },
            alignment: {
                horizontal: 'center'
            }
        };
        cover.getRow(4).height = 26;
        // Empty row
        cover.getRow(5).height = 10;
        // Metadata
        const metaRows = [
            [
                '📍 Ubicación',
                content.location
            ],
            [
                '🏢 Empresa',
                content.company ?? '—'
            ],
            [
                '📅 Período',
                `${content.period.from}  →  ${content.period.to}`
            ],
            [
                '🕐 Generado',
                content.generatedAt
            ],
            [
                '🌍 Coordenadas',
                '11.5444°N, 72.9072°O'
            ]
        ];
        metaRows.forEach(([label, value], i)=>{
            const row = cover.getRow(6 + i);
            row.getCell(1).value = label;
            row.getCell(2).value = value;
            row.getCell(1).style = {
                font: {
                    bold: true,
                    color: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: 'FFEFF6FF'
                    }
                }
            };
            row.getCell(2).style = {
                font: {
                    size: 11
                }
            };
            row.height = 22;
        });
        cover.getColumn(1).width = 24;
        cover.getColumn(2).width = 54;
        for(let c = 3; c <= 8; c++)cover.getColumn(c).width = 14;
        let coverNextRow = 12; // row after metadata
        // ── Chart image in cover ─────────────────────────────────────────────────
        if (chartBuf) {
            const chartId = workbook.addImage({
                buffer: chartBuf,
                extension: 'png'
            });
            cover.mergeCells(`A${coverNextRow}:H${coverNextRow}`);
            cover.getCell(`A${coverNextRow}`).value = '📊 Radiación Solar Promedio Mensual (kWh/m²/día)';
            cover.getCell(`A${coverNextRow}`).style = {
                font: {
                    bold: true,
                    size: 13,
                    color: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                alignment: {
                    horizontal: 'left',
                    indent: 1,
                    vertical: 'middle'
                }
            };
            cover.getCell(`A${coverNextRow}`).font = {
                bold: true,
                size: 13,
                color: {
                    argb: 'FFFFFFFF'
                }
            };
            cover.getRow(coverNextRow).height = 32;
            coverNextRow++;
            cover.addImage(chartId, {
                tl: {
                    col: 0,
                    row: coverNextRow - 1
                },
                ext: {
                    width: 720,
                    height: 330
                },
                editAs: 'oneCell'
            });
            // Reserve rows for the chart height (approximately 330px / 20px per row ≈ 17 rows)
            for(let r = 0; r < 17; r++){
                cover.getRow(coverNextRow + r).height = 20;
            }
            coverNextRow += 18;
            // Source note
            cover.mergeCells(`A${coverNextRow}:H${coverNextRow}`);
            cover.getCell(`A${coverNextRow}`).value = 'Fuente: NASA POWER API · Parámetro: ALLSKY_SFC_SW_DWN · Promedio mensual';
            cover.getCell(`A${coverNextRow}`).style = {
                font: {
                    italic: true,
                    size: 9,
                    color: {
                        argb: 'FF888888'
                    }
                },
                alignment: {
                    horizontal: 'center'
                }
            };
            coverNextRow += 2;
        }
        // ── Map image in cover ───────────────────────────────────────────────────
        if (mapBuf) {
            const mapId = workbook.addImage({
                buffer: mapBuf,
                extension: 'png'
            });
            cover.mergeCells(`A${coverNextRow}:H${coverNextRow}`);
            cover.getCell(`A${coverNextRow}`).value = '📍 Ubicación del Proyecto – Riohacha, La Guajira';
            cover.getCell(`A${coverNextRow}`).style = {
                font: {
                    bold: true,
                    size: 13,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                alignment: {
                    horizontal: 'left',
                    indent: 1,
                    vertical: 'middle'
                }
            };
            cover.getRow(coverNextRow).height = 32;
            coverNextRow++;
            cover.addImage(mapId, {
                tl: {
                    col: 0,
                    row: coverNextRow - 1
                },
                ext: {
                    width: 720,
                    height: 320
                },
                editAs: 'oneCell'
            });
            for(let r = 0; r < 16; r++)cover.getRow(coverNextRow + r).height = 20;
            coverNextRow += 17;
            cover.mergeCells(`A${coverNextRow}:H${coverNextRow}`);
            cover.getCell(`A${coverNextRow}`).value = 'Riohacha, capital de La Guajira — 11.5444°N, 72.9072°O. Fuente: © OpenStreetMap contributors.';
            cover.getCell(`A${coverNextRow}`).style = {
                font: {
                    italic: true,
                    size: 9,
                    color: {
                        argb: 'FF888888'
                    }
                },
                alignment: {
                    horizontal: 'center'
                }
            };
        }
        // ── Chart data sheet ─────────────────────────────────────────────────────
        if (content.chartData?.labels.length) {
            const chartWs = workbook.addWorksheet('Datos Gráfica');
            chartWs.mergeCells('A1:B1');
            chartWs.getCell('A1').value = '📊 Radiación Solar Promedio Mensual';
            chartWs.getCell('A1').style = {
                font: {
                    bold: true,
                    size: 13,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                alignment: {
                    horizontal: 'left',
                    indent: 1,
                    vertical: 'middle'
                }
            };
            chartWs.getRow(1).height = 32;
            chartWs.getCell('A2').value = 'Mes';
            chartWs.getCell('B2').value = 'kWh/m²/día';
            [
                'A2',
                'B2'
            ].forEach((addr)=>{
                chartWs.getCell(addr).style = {
                    font: {
                        bold: true,
                        color: {
                            argb: 'FFFFFFFF'
                        }
                    },
                    fill: {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: `FF${ACCENT_COLOR}`
                        }
                    },
                    alignment: {
                        horizontal: 'center'
                    }
                };
            });
            chartWs.getRow(2).height = 24;
            content.chartData.labels.forEach((lbl, i)=>{
                const r = chartWs.getRow(3 + i);
                r.getCell(1).value = lbl;
                r.getCell(2).value = content.chartData.values[i];
                r.getCell(2).numFmt = '0.00';
                if (i % 2 === 1) {
                    [
                        'A',
                        'B'
                    ].forEach((col)=>{
                        chartWs.getCell(`${col}${3 + i}`).fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: {
                                argb: `FF${ALT_ROW_COLOR}`
                            }
                        };
                    });
                }
                r.height = 20;
            });
            chartWs.getColumn(1).width = 16;
            chartWs.getColumn(2).width = 20;
        }
        // ── Data sheet per section ────────────────────────────────────────────────
        content.sections.forEach((section, si)=>{
            const sheetName = `${si + 1}. ${section.title.substring(0, 28)}`;
            const ws = workbook.addWorksheet(sheetName);
            let rowIdx = 1;
            // Section title
            ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
            ws.getCell(`A${rowIdx}`).value = section.title;
            ws.getCell(`A${rowIdx}`).style = {
                font: {
                    bold: true,
                    size: 14,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                alignment: {
                    horizontal: 'left',
                    vertical: 'middle',
                    indent: 1
                }
            };
            ws.getRow(rowIdx).height = 36;
            rowIdx += 2;
            // Key metrics
            if (section.keyMetrics?.length) {
                section.keyMetrics.forEach(({ label, value, unit })=>{
                    ws.getCell(`A${rowIdx}`).value = label;
                    ws.getCell(`B${rowIdx}`).value = `${value}${unit ? ` ${unit}` : ''}`;
                    ws.getCell(`A${rowIdx}`).style = {
                        font: {
                            bold: true,
                            color: {
                                argb: `FF${HEADER_COLOR}`
                            }
                        },
                        fill: {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: {
                                argb: 'FFEFF6FF'
                            }
                        }
                    };
                    ws.getCell(`B${rowIdx}`).style = {
                        font: {
                            bold: true,
                            size: 13,
                            color: {
                                argb: `FF${ACCENT_COLOR}`
                            }
                        }
                    };
                    ws.getRow(rowIdx).height = 24;
                    rowIdx++;
                });
                rowIdx++;
            }
            // Paragraphs
            if (section.paragraphs?.length) {
                section.paragraphs.forEach((p)=>{
                    ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
                    ws.getCell(`A${rowIdx}`).value = p;
                    ws.getCell(`A${rowIdx}`).style = {
                        alignment: {
                            wrapText: true
                        }
                    };
                    ws.getRow(rowIdx).height = Math.max(20, Math.ceil(p.length / 80) * 16);
                    rowIdx++;
                });
                rowIdx++;
            }
            // Table
            if (section.table) {
                const { headers, rows } = section.table;
                headers.forEach((h, ci)=>{
                    const cell = ws.getCell(rowIdx, ci + 1);
                    cell.value = h;
                    cell.style = {
                        font: {
                            bold: true,
                            color: {
                                argb: 'FFFFFFFF'
                            }
                        },
                        fill: {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: {
                                argb: `FF${ACCENT_COLOR}`
                            }
                        },
                        alignment: {
                            horizontal: 'center'
                        }
                    };
                });
                ws.getRow(rowIdx).height = 24;
                rowIdx++;
                rows.forEach((r, ri)=>{
                    const isAlt = ri % 2 === 1;
                    r.forEach((val, ci)=>{
                        const cell = ws.getCell(rowIdx, ci + 1);
                        cell.value = val;
                        if (isAlt) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: {
                                    argb: `FF${ALT_ROW_COLOR}`
                                }
                            };
                        }
                        cell.alignment = {
                            horizontal: typeof val === 'number' ? 'right' : 'left'
                        };
                    });
                    rowIdx++;
                });
            }
            ws.columns.forEach((col)=>{
                col.width = 20;
            });
        });
        // ── Recommendations sheet ────────────────────────────────────────────────
        if (content.recommendations.length) {
            const recWs = workbook.addWorksheet('Recomendaciones');
            recWs.mergeCells('A1:D1');
            recWs.getCell('A1').value = '✅ Recomendaciones';
            recWs.getCell('A1').style = {
                font: {
                    bold: true,
                    size: 14,
                    color: {
                        argb: 'FFFFFFFF'
                    }
                },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: `FF${HEADER_COLOR}`
                    }
                },
                alignment: {
                    horizontal: 'left',
                    indent: 1,
                    vertical: 'middle'
                }
            };
            recWs.getRow(1).height = 36;
            content.recommendations.forEach((rec, i)=>{
                recWs.mergeCells(`A${i + 2}:D${i + 2}`);
                recWs.getCell(`A${i + 2}`).value = `${i + 1}. ${rec}`;
                recWs.getCell(`A${i + 2}`).style = {
                    alignment: {
                        wrapText: true
                    },
                    fill: i % 2 === 1 ? {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: `FF${ALT_ROW_COLOR}`
                        }
                    } : undefined
                };
                recWs.getRow(i + 2).height = Math.max(22, Math.ceil(rec.length / 80) * 16);
            });
            recWs.getColumn(1).width = 100;
        }
        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }
    constructor(){
        _define_property(this, "mimeType", 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        _define_property(this, "fileExtension", 'xlsx');
        _define_property(this, "chartService", new _ChartImageService.ChartImageService());
    }
};

//# sourceMappingURL=ExcelReportAdapter.js.map