import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * HttpClient - Adaptador de infraestructura compartido
 * Principio: Dependency Inversion - los módulos dependen de esta abstracción
 */
export class HttpClient {
  private readonly client: AxiosInstance;

  constructor(baseURL: string, timeoutMs?: number) {
    this.client = axios.create({
      baseURL,
      ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  setAuthHeader(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}
