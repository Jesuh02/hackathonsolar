import { WhatsAppPort, SendMessageOptions, SendOtpOptions } from '../../domain/ports/WhatsAppPort';
import { Result } from '@shared/domain/Result';
import { HttpClient } from '@shared/infrastructure/HttpClient';

interface YCloudSendResponse {
  id: string;
  status: string;
}

/**
 * YCloud WhatsApp adapter - communicates with YCloud REST API v2
 * https://docs.ycloud.com/reference/whatsapp_message_send
 */
export class YCloudWhatsAppAdapter implements WhatsAppPort {
  private readonly httpClient: HttpClient;
  private readonly senderPhone: string; // E.164 without +, e.g. "573044271932"

  constructor(apiKey: string, baseUrl: string, senderPhone: string) {
    this.httpClient = new HttpClient(baseUrl);
    this.httpClient.setHeader('X-API-Key', apiKey);
    // Strip leading + if present
    this.senderPhone = senderPhone.replace(/^\+/, '');
  }

  async sendMessage(options: SendMessageOptions): Promise<Result<void>> {
    try {
      await this.httpClient.post<YCloudSendResponse>('/whatsapp/messages', {
        from: this.senderPhone,
        to: options.to,
        type: 'text',
        text: { body: options.body },
      });
      return Result.ok<void>(undefined as unknown as void);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[YCloudWhatsAppAdapter] sendMessage error:', msg);
      return Result.fail<void>(`WhatsApp send failed: ${msg}`);
    }
  }

  async sendOtp(options: SendOtpOptions): Promise<Result<void>> {
    const body =
      `🔐 *Agente Solar – Código de verificación*\n\n` +
      `Tu código es: *${options.code}*\n\n` +
      `Válido por 10 minutos. No lo compartas con nadie.`;
    return this.sendMessage({ to: options.to, body });
  }
}
