import { OtpCode } from '../../domain/entities/OtpCode';
import { WhatsAppPort } from '../../domain/ports/WhatsAppPort';
import { Result } from '@shared/domain/Result';

/**
 * In-memory OTP store (sufficient for stateless single-instance deployments)
 * key = phone number (E.164)
 */
const otpStore = new Map<string, OtpCode>();

export class SendOtpUseCase {
  constructor(private readonly whatsApp: WhatsAppPort) {}

  async execute(phone: string): Promise<Result<void>> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) {
      return Result.fail<void>('Número de teléfono inválido. Usa formato internacional, ej: +573001234567');
    }

    const otp = OtpCode.create(normalized, 600); // 10 minutes TTL
    otpStore.set(normalized, otp);

    const result = await this.whatsApp.sendOtp({ to: normalized, code: otp.code });
    if (result.isFailure) {
      otpStore.delete(normalized);
      return Result.fail<void>(result.error);
    }

    return Result.ok<void>(undefined as unknown as void);
  }

  private normalizePhone(phone: string): string | null {
    const cleaned = phone.replace(/\s/g, '');
    // Must start with + and have 7-15 digits
    if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
    return null;
  }
}

export { otpStore };
