import axios from 'axios';

const RIOHACHA_MAP_URL =
  'https://staticmap.openstreetmap.de/staticmap.php' +
  '?center=11.5444,-72.9072&zoom=13&size=600x320' +
  '&maptype=mapnik' +
  '&markers=11.5444,-72.9072,lightblue1';

export class ChartImageService {
  /**
   * Fetches a bar-chart PNG from QuickChart.io (free, no API key).
   * Returns null on any network/timeout error – callers must handle gracefully.
   */
  async getBarChartPng(
    labels: string[],
    values: number[],
    title: string,
  ): Promise<Buffer | null> {
    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'kWh/m²/día',
            data: values,
            backgroundColor: 'rgba(30,58,95,0.87)',
            borderColor: '#F59E0B',
            borderWidth: 2,
            borderRadius: 5,
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: title,
            color: '#1E3A5F',
            font: { size: 15, weight: 'bold' },
            padding: { bottom: 10 },
          },
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: '#E8EDF2' },
            ticks: { color: '#555' },
            title: { display: true, text: 'kWh/m²/día', color: '#666' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#444', maxRotation: 45 },
          },
        },
        layout: { padding: { left: 4, right: 4, top: 4, bottom: 4 } },
      },
    };

    const encoded = encodeURIComponent(JSON.stringify(config));
    const url = `https://quickchart.io/chart?c=${encoded}&w=620&h=300&bkg=white&devicePixelRatio=1.5`;

    try {
      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      return Buffer.from(res.data);
    } catch {
      return null;
    }
  }

  /**
   * Fetches a static PNG map tile of Riohacha from OpenStreetMap.
   * Returns null on failure.
   */
  async getRiohachaMapPng(): Promise<Buffer | null> {
    try {
      const res = await axios.get<ArrayBuffer>(RIOHACHA_MAP_URL, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'AgentesSolar/1.0 (hackathon project)' },
      });
      return Buffer.from(res.data);
    } catch {
      return null;
    }
  }
}
