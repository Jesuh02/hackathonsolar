"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WordReportAdapter", {
    enumerable: true,
    get: function() {
        return WordReportAdapter;
    }
});
const _docx = require("docx");
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
const PRIMARY_HEX = '1E3A5F';
const ACCENT_HEX = 'F59E0B';
const LIGHT_HEX = 'F0F4F8';
let WordReportAdapter = class WordReportAdapter {
    async generate(content) {
        // Pre-fetch images before building the document object
        const [chartBuf, mapBuf] = await Promise.all([
            content.chartData ? this.chartService.getBarChartPng(content.chartData.labels, content.chartData.values, content.chartData.title ?? 'RadiaciÃ³n Solar Promedio Mensual (kWh/mÂ²/dÃ­a)') : Promise.resolve(null),
            this.chartService.getRiohachaMapPng()
        ]);
        const children = [];
        // â”€â”€ Cover â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        children.push(new _docx.Paragraph({
            text: 'â˜€ï¸ AGENTE SOLAR - RIOHACHA',
            heading: _docx.HeadingLevel.TITLE,
            alignment: _docx.AlignmentType.CENTER,
            run: {
                color: PRIMARY_HEX,
                bold: true,
                size: 52
            }
        }), new _docx.Paragraph({
            text: '',
            spacing: {
                after: 160
            }
        }), new _docx.Paragraph({
            children: [
                new _docx.TextRun({
                    text: content.title,
                    bold: true,
                    size: 40,
                    color: PRIMARY_HEX
                })
            ],
            alignment: _docx.AlignmentType.CENTER
        }), new _docx.Paragraph({
            children: [
                new _docx.TextRun({
                    text: content.subtitle,
                    italics: true,
                    size: 24,
                    color: '666666'
                })
            ],
            alignment: _docx.AlignmentType.CENTER,
            spacing: {
                after: 400
            }
        }), ...this.metaBlock([
            [
                'ðŸ“ UbicaciÃ³n',
                content.location
            ],
            ...content.company ? [
                [
                    'ðŸ¢ Empresa',
                    content.company
                ]
            ] : [],
            [
                'ðŸ“… PerÃ­odo',
                `${content.period.from} â€“ ${content.period.to}`
            ],
            [
                'ðŸ• Generado',
                content.generatedAt
            ]
        ]));
        // â”€â”€ Mapa de Riohacha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        children.push(new _docx.Paragraph({
            text: 'ðŸ“ UbicaciÃ³n del Proyecto â€“ Riohacha, La Guajira',
            heading: _docx.HeadingLevel.HEADING_1,
            run: {
                color: 'FFFFFF',
                bold: true,
                size: 28
            },
            shading: {
                type: _docx.ShadingType.SOLID,
                color: PRIMARY_HEX
            },
            spacing: {
                before: 600,
                after: 240
            },
            pageBreakBefore: true
        }));
        if (mapBuf) {
            children.push(new _docx.Paragraph({
                children: [
                    new _docx.ImageRun({
                        data: mapBuf,
                        transformation: {
                            width: 500,
                            height: 230
                        },
                        type: 'png'
                    })
                ],
                alignment: _docx.AlignmentType.CENTER,
                spacing: {
                    after: 120
                }
            }), new _docx.Paragraph({
                children: [
                    new _docx.TextRun({
                        text: 'Riohacha, capital de La Guajira â€” 11.5444Â°N, 72.9072Â°O. Fuente: Â© OpenStreetMap contributors.',
                        italics: true,
                        size: 16,
                        color: '888888'
                    })
                ],
                alignment: _docx.AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));
        }
        children.push(new _docx.Paragraph({
            children: [
                new _docx.TextRun({
                    text: 'Riohacha se ubica en el litoral caribeÃ±o colombiano. La Guajira es una de las zonas con mayor irradiaciÃ³n solar de AmÃ©rica del Sur, con valores anuales superiores a 5.5 kWh/mÂ²/dÃ­a. Su posiciÃ³n geogrÃ¡fica privilegiada â€”cercana al Ecuador y con escasa nubosidadâ€” la convierte en un territorio de altÃ­simo potencial fotovoltaico.',
                    size: 20
                })
            ],
            alignment: _docx.AlignmentType.JUSTIFIED,
            spacing: {
                after: 300
            }
        }));
        // â”€â”€ GrÃ¡fica de radiaciÃ³n solar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (chartBuf) {
            children.push(new _docx.Paragraph({
                text: 'ðŸ“Š RadiaciÃ³n Solar Promedio Mensual',
                heading: _docx.HeadingLevel.HEADING_1,
                run: {
                    color: 'FFFFFF',
                    bold: true,
                    size: 28
                },
                shading: {
                    type: _docx.ShadingType.SOLID,
                    color: PRIMARY_HEX
                },
                spacing: {
                    before: 600,
                    after: 240
                },
                pageBreakBefore: true
            }), new _docx.Paragraph({
                children: [
                    new _docx.ImageRun({
                        data: chartBuf,
                        transformation: {
                            width: 500,
                            height: 240
                        },
                        type: 'png'
                    })
                ],
                alignment: _docx.AlignmentType.CENTER,
                spacing: {
                    after: 120
                }
            }), new _docx.Paragraph({
                children: [
                    new _docx.TextRun({
                        text: 'Fuente: NASA POWER API Â· ParÃ¡metro: ALLSKY_SFC_SW_DWN Â· Promedio mensual (kWh/mÂ²/dÃ­a).',
                        italics: true,
                        size: 16,
                        color: '888888'
                    })
                ],
                alignment: _docx.AlignmentType.CENTER,
                spacing: {
                    after: 200
                }
            }));
        }
        // â”€â”€ Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        content.sections.forEach((section)=>{
            children.push(new _docx.Paragraph({
                text: section.title,
                heading: _docx.HeadingLevel.HEADING_1,
                run: {
                    color: 'FFFFFF',
                    bold: true,
                    size: 28
                },
                shading: {
                    type: _docx.ShadingType.SOLID,
                    color: PRIMARY_HEX
                },
                spacing: {
                    before: 600,
                    after: 200
                },
                pageBreakBefore: true
            }));
            if (section.keyMetrics?.length) {
                section.keyMetrics.forEach(({ label, value, unit })=>{
                    children.push(new _docx.Paragraph({
                        children: [
                            new _docx.TextRun({
                                text: `${label}: `,
                                bold: true,
                                color: PRIMARY_HEX,
                                size: 22
                            }),
                            new _docx.TextRun({
                                text: `${value}${unit ? ` ${unit}` : ''}`,
                                bold: true,
                                color: ACCENT_HEX,
                                size: 26
                            })
                        ],
                        spacing: {
                            after: 100
                        }
                    }));
                });
            }
            if (section.paragraphs?.length) {
                section.paragraphs.forEach((p)=>{
                    children.push(new _docx.Paragraph({
                        children: [
                            new _docx.TextRun({
                                text: p,
                                size: 20
                            })
                        ],
                        alignment: _docx.AlignmentType.JUSTIFIED,
                        spacing: {
                            after: 160
                        }
                    }));
                });
            }
            if (section.table) {
                children.push(this.buildTable(section.table.headers, section.table.rows));
            }
        });
        // â”€â”€ Recommendations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (content.recommendations.length) {
            children.push(new _docx.Paragraph({
                text: 'âœ… Recomendaciones',
                heading: _docx.HeadingLevel.HEADING_1,
                run: {
                    color: 'FFFFFF',
                    bold: true,
                    size: 28
                },
                shading: {
                    type: _docx.ShadingType.SOLID,
                    color: PRIMARY_HEX
                },
                spacing: {
                    before: 600,
                    after: 200
                },
                pageBreakBefore: true
            }));
            content.recommendations.forEach((rec, i)=>{
                children.push(new _docx.Paragraph({
                    children: [
                        new _docx.TextRun({
                            text: `${i + 1}. `,
                            bold: true,
                            color: PRIMARY_HEX,
                            size: 22
                        }),
                        new _docx.TextRun({
                            text: rec,
                            size: 20
                        })
                    ],
                    spacing: {
                        after: 140
                    }
                }));
            });
        }
        // â”€â”€ Conclusion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (content.conclusion) {
            children.push(new _docx.Paragraph({
                text: 'ðŸ“ ConclusiÃ³n Ejecutiva',
                heading: _docx.HeadingLevel.HEADING_1,
                shading: {
                    type: _docx.ShadingType.SOLID,
                    color: PRIMARY_HEX
                },
                run: {
                    color: 'FFFFFF',
                    bold: true,
                    size: 28
                },
                spacing: {
                    before: 600,
                    after: 200
                },
                pageBreakBefore: true
            }), new _docx.Paragraph({
                children: [
                    new _docx.TextRun({
                        text: content.conclusion,
                        size: 20
                    })
                ],
                alignment: _docx.AlignmentType.JUSTIFIED
            }));
        }
        const doc = new _docx.Document({
            sections: [
                {
                    headers: {
                        default: new _docx.Header({
                            children: [
                                new _docx.Paragraph({
                                    children: [
                                        new _docx.TextRun({
                                            text: 'â˜€ Agente Solar â€“ Riohacha, La Guajira',
                                            color: PRIMARY_HEX,
                                            size: 18,
                                            bold: true
                                        })
                                    ],
                                    alignment: _docx.AlignmentType.RIGHT
                                })
                            ]
                        })
                    },
                    footers: {
                        default: new _docx.Footer({
                            children: [
                                new _docx.Paragraph({
                                    children: [
                                        new _docx.TextRun({
                                            text: content.title + '  |  PÃ¡gina ',
                                            size: 18,
                                            color: '888888'
                                        }),
                                        new _docx.TextRun({
                                            children: [
                                                _docx.PageNumber.CURRENT
                                            ],
                                            size: 18,
                                            color: '888888'
                                        }),
                                        new _docx.TextRun({
                                            text: ' de ',
                                            size: 18,
                                            color: '888888'
                                        }),
                                        new _docx.TextRun({
                                            children: [
                                                _docx.PageNumber.TOTAL_PAGES
                                            ],
                                            size: 18,
                                            color: '888888'
                                        })
                                    ],
                                    alignment: _docx.AlignmentType.CENTER
                                })
                            ]
                        })
                    },
                    properties: {
                        page: {
                            pageNumbers: {
                                start: 1,
                                formatType: _docx.NumberFormat.DECIMAL
                            }
                        }
                    },
                    children
                }
            ]
        });
        const buffer = await _docx.Packer.toBuffer(doc);
        return Buffer.from(buffer);
    }
    metaBlock(rows) {
        return rows.map(([label, value])=>new _docx.Paragraph({
                children: [
                    new _docx.TextRun({
                        text: `${label}: `,
                        bold: true,
                        color: PRIMARY_HEX,
                        size: 20
                    }),
                    new _docx.TextRun({
                        text: value,
                        size: 20
                    })
                ],
                spacing: {
                    after: 80
                }
            }));
    }
    buildTable(headers, rows) {
        const headerRow = new _docx.TableRow({
            children: headers.map((h)=>new _docx.TableCell({
                    children: [
                        new _docx.Paragraph({
                            children: [
                                new _docx.TextRun({
                                    text: h,
                                    bold: true,
                                    color: 'FFFFFF',
                                    size: 18
                                })
                            ],
                            alignment: _docx.AlignmentType.CENTER
                        })
                    ],
                    shading: {
                        type: _docx.ShadingType.SOLID,
                        color: ACCENT_HEX
                    },
                    margins: {
                        top: 80,
                        bottom: 80,
                        left: 100,
                        right: 100
                    }
                }))
        });
        const dataRows = rows.map((row, ri)=>new _docx.TableRow({
                children: row.map((cell)=>new _docx.TableCell({
                        children: [
                            new _docx.Paragraph({
                                children: [
                                    new _docx.TextRun({
                                        text: String(cell),
                                        size: 18
                                    })
                                ],
                                alignment: typeof cell === 'number' ? _docx.AlignmentType.RIGHT : _docx.AlignmentType.LEFT
                            })
                        ],
                        shading: ri % 2 === 1 ? {
                            type: _docx.ShadingType.SOLID,
                            color: LIGHT_HEX
                        } : undefined,
                        margins: {
                            top: 60,
                            bottom: 60,
                            left: 100,
                            right: 100
                        }
                    }))
            }));
        return new _docx.Table({
            width: {
                size: 100,
                type: _docx.WidthType.PERCENTAGE
            },
            borders: {
                top: {
                    style: _docx.BorderStyle.SINGLE,
                    size: 1,
                    color: 'CCCCCC'
                },
                bottom: {
                    style: _docx.BorderStyle.SINGLE,
                    size: 1,
                    color: 'CCCCCC'
                },
                left: {
                    style: _docx.BorderStyle.SINGLE,
                    size: 1,
                    color: 'CCCCCC'
                },
                right: {
                    style: _docx.BorderStyle.SINGLE,
                    size: 1,
                    color: 'CCCCCC'
                },
                insideH: {
                    style: _docx.BorderStyle.SINGLE,
                    size: 1,
                    color: 'DDDDDD'
                },
                insideV: {
                    style: _docx.BorderStyle.SINGLE,
                    size: 1,
                    color: 'DDDDDD'
                }
            },
            rows: [
                headerRow,
                ...dataRows
            ]
        });
    }
    constructor(){
        _define_property(this, "mimeType", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        _define_property(this, "fileExtension", 'docx');
        _define_property(this, "chartService", new _ChartImageService.ChartImageService());
    }
};

//# sourceMappingURL=WordReportAdapter.js.map