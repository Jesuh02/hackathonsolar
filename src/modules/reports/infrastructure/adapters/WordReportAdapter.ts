import { ReportGeneratorPort, ReportContent } from '../../domain/ports/ReportGeneratorPort';
import {
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import { ChartImageService } from '../services/ChartImageService';

const PRIMARY_HEX = '1E3A5F';
const ACCENT_HEX = 'F59E0B';
const LIGHT_HEX = 'F0F4F8';

export class WordReportAdapter implements ReportGeneratorPort {
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  readonly fileExtension = 'docx';

  private readonly chartService = new ChartImageService();

  async generate(content: ReportContent): Promise<Buffer> {
    // Pre-fetch images before building the document object
    const [chartBuf, mapBuf] = await Promise.all([
      content.chartData
        ? this.chartService.getBarChartPng(
            content.chartData.labels,
            content.chartData.values,
            content.chartData.title ?? 'RadiaciÃ³n Solar Promedio Mensual (kWh/mÂ²/dÃ­a)',
          )
        : Promise.resolve(null),
      this.chartService.getRiohachaMapPng(),
    ]);

    const children: (Paragraph | Table)[] = [];

    // â”€â”€ Cover â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    children.push(
      new Paragraph({
        text: 'â˜€ï¸ AGENTE SOLAR - RIOHACHA',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        run: { color: PRIMARY_HEX, bold: true, size: 52 },
      }),
      new Paragraph({ text: '', spacing: { after: 160 } }),
      new Paragraph({
        children: [new TextRun({ text: content.title, bold: true, size: 40, color: PRIMARY_HEX })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: content.subtitle, italics: true, size: 24, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      ...this.metaBlock([
        ['ðŸ“ UbicaciÃ³n', content.location],
        ...(content.company ? [['ðŸ¢ Empresa', content.company] as [string, string]] : []),
        ['ðŸ“… PerÃ­odo', `${content.period.from} â€“ ${content.period.to}`],
        ['ðŸ• Generado', content.generatedAt],
      ]),
    );

    // â”€â”€ Mapa de Riohacha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    children.push(
      new Paragraph({
        text: 'ðŸ“ UbicaciÃ³n del Proyecto â€“ Riohacha, La Guajira',
        heading: HeadingLevel.HEADING_1,
        run: { color: 'FFFFFF', bold: true, size: 28 },
        shading: { type: ShadingType.SOLID, color: PRIMARY_HEX },
        spacing: { before: 600, after: 240 },
        pageBreakBefore: true,
      }),
    );

    if (mapBuf) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: mapBuf,
              transformation: { width: 500, height: 230 },
              type: 'png',
            } as Parameters<typeof ImageRun>[0]),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Riohacha, capital de La Guajira â€” 11.5444Â°N, 72.9072Â°O. Fuente: Â© OpenStreetMap contributors.',
              italics: true, size: 16, color: '888888',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Riohacha se ubica en el litoral caribeÃ±o colombiano. La Guajira es una de las zonas con mayor irradiaciÃ³n solar de AmÃ©rica del Sur, con valores anuales superiores a 5.5 kWh/mÂ²/dÃ­a. Su posiciÃ³n geogrÃ¡fica privilegiada â€”cercana al Ecuador y con escasa nubosidadâ€” la convierte en un territorio de altÃ­simo potencial fotovoltaico.',
            size: 20,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 300 },
      }),
    );

    // â”€â”€ GrÃ¡fica de radiaciÃ³n solar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (chartBuf) {
      children.push(
        new Paragraph({
          text: 'ðŸ“Š RadiaciÃ³n Solar Promedio Mensual',
          heading: HeadingLevel.HEADING_1,
          run: { color: 'FFFFFF', bold: true, size: 28 },
          shading: { type: ShadingType.SOLID, color: PRIMARY_HEX },
          spacing: { before: 600, after: 240 },
          pageBreakBefore: true,
        }),
        new Paragraph({
          children: [
            new ImageRun({
              data: chartBuf,
              transformation: { width: 500, height: 240 },
              type: 'png',
            } as Parameters<typeof ImageRun>[0]),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Fuente: NASA POWER API Â· ParÃ¡metro: ALLSKY_SFC_SW_DWN Â· Promedio mensual (kWh/mÂ²/dÃ­a).',
              italics: true, size: 16, color: '888888',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );
    }

    // â”€â”€ Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    content.sections.forEach((section) => {
      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          run: { color: 'FFFFFF', bold: true, size: 28 },
          shading: { type: ShadingType.SOLID, color: PRIMARY_HEX },
          spacing: { before: 600, after: 200 },
          pageBreakBefore: true,
        }),
      );

      if (section.keyMetrics?.length) {
        section.keyMetrics.forEach(({ label, value, unit }) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label}: `, bold: true, color: PRIMARY_HEX, size: 22 }),
                new TextRun({ text: `${value}${unit ? ` ${unit}` : ''}`, bold: true, color: ACCENT_HEX, size: 26 }),
              ],
              spacing: { after: 100 },
            }),
          );
        });
      }

      if (section.paragraphs?.length) {
        section.paragraphs.forEach((p) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: p, size: 20 })],
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 160 },
            }),
          );
        });
      }

      if (section.table) {
        children.push(this.buildTable(section.table.headers, section.table.rows));
      }
    });

    // â”€â”€ Recommendations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (content.recommendations.length) {
      children.push(
        new Paragraph({
          text: 'âœ… Recomendaciones',
          heading: HeadingLevel.HEADING_1,
          run: { color: 'FFFFFF', bold: true, size: 28 },
          shading: { type: ShadingType.SOLID, color: PRIMARY_HEX },
          spacing: { before: 600, after: 200 },
          pageBreakBefore: true,
        }),
      );
      content.recommendations.forEach((rec, i) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${i + 1}. `, bold: true, color: PRIMARY_HEX, size: 22 }),
              new TextRun({ text: rec, size: 20 }),
            ],
            spacing: { after: 140 },
          }),
        );
      });
    }

    // â”€â”€ Conclusion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (content.conclusion) {
      children.push(
        new Paragraph({
          text: 'ðŸ“ ConclusiÃ³n Ejecutiva',
          heading: HeadingLevel.HEADING_1,
          shading: { type: ShadingType.SOLID, color: PRIMARY_HEX },
          run: { color: 'FFFFFF', bold: true, size: 28 },
          spacing: { before: 600, after: 200 },
          pageBreakBefore: true,
        }),
        new Paragraph({
          children: [new TextRun({ text: content.conclusion, size: 20 })],
          alignment: AlignmentType.JUSTIFIED,
        }),
      );
    }

    const doc = new Document({
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'â˜€ Agente Solar â€“ Riohacha, La Guajira', color: PRIMARY_HEX, size: 18, bold: true }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: content.title + '  |  PÃ¡gina ', size: 18, color: '888888' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' }),
                    new TextRun({ text: ' de ', size: 18, color: '888888' }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '888888' }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          properties: { page: { pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }

  private metaBlock(rows: [string, string][]): Paragraph[] {
    return rows.map(
      ([label, value]) =>
        new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, color: PRIMARY_HEX, size: 20 }),
            new TextRun({ text: value, size: 20 }),
          ],
          spacing: { after: 80 },
        }),
    );
  }

  private buildTable(headers: string[], rows: Array<Array<string | number>>): Table {
    const headerRow = new TableRow({
      children: headers.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })],
            shading: { type: ShadingType.SOLID, color: ACCENT_HEX },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
          }),
      ),
    });

    const dataRows = rows.map(
      (row, ri) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: String(cell), size: 18 })],
                  alignment: typeof cell === 'number' ? AlignmentType.RIGHT : AlignmentType.LEFT,
                })],
                shading: ri % 2 === 1 ? { type: ShadingType.SOLID, color: LIGHT_HEX } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
              }),
          ),
        }),
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideH: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        insideV: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      },
      rows: [headerRow, ...dataRows],
    });
  }
}

