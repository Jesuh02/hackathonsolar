import axios from 'axios';
import { SendOtpRequest, SendOtpResponse, VerifyOtpRequest, VerifyOtpResponse } from '@/types/whatsapp.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const client = axios.create({ baseURL: `${API_BASE}/api/whatsapp` });

export const whatsappApi = {
  sendOtp: async (data: SendOtpRequest): Promise<SendOtpResponse> => {
    const res = await client.post<SendOtpResponse>('/send-otp', data);
    return res.data;
  },

  verifyOtp: async (data: VerifyOtpRequest): Promise<VerifyOtpResponse> => {
    const res = await client.post<VerifyOtpResponse>('/verify-otp', data);
    return res.data;
  },
};

export const reportsApi = {
  generate: async (query: string, format: 'excel' | 'pdf' | 'word', startDate?: string, endDate?: string): Promise<Blob> => {
    const res = await axios.post(
      `${API_BASE}/api/reports/generate`,
      { query, format, startDate, endDate },
      { responseType: 'blob', timeout: 120000 }
    );
    return res.data as Blob;
  },
};
