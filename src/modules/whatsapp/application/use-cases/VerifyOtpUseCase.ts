import { otpStore } from './SendOtpUseCase';
import { Result } from '@shared/domain/Result';

export interface VerifyOtpResult {
  verified: boolean;
  phone: string;
}

export class VerifyOtpUseCase {
  async execute(phone: string, code: string): Promise<Result<VerifyOtpResult>> {
    const normalized = phone.trim();
    const stored = otpStore.get(normalized);

    if (!stored) {
      return Result.fail<VerifyOtpResult>('No se encontró un código OTP para este número. Solicita uno nuevo.');
    }

    if (stored.isExpired()) {
      otpStore.delete(normalized);
      return Result.fail<VerifyOtpResult>('El código ha expirado. Solicita uno nuevo.');
    }

    if (!stored.isValid(code)) {
      // Increment attempts
      const updated = stored.withIncrementedAttempts();
      otpStore.set(normalized, updated);
      const remaining = 4 - updated.attempts;
      return Result.fail<VerifyOtpResult>(
        remaining > 0 ? `Código incorrecto. Te quedan ${remaining} intentos.` : 'Demasiados intentos. Solicita un código nuevo.'
      );
    }

    // Successful verification - remove OTP from store
    otpStore.delete(normalized);
    return Result.ok<VerifyOtpResult>({ verified: true, phone: normalized });
  }
}
