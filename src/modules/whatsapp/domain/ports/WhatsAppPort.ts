import { Result } from '@shared/domain/Result';

export interface SendMessageOptions {
  to: string;        // recipient phone number with country code, e.g. "+573001234567"
  body: string;      // plain-text message body
}

export interface SendOtpOptions {
  to: string;        // recipient phone number
  code: string;      // 6-digit OTP
}

/**
 * Port for WhatsApp messaging - defines the contract for any WhatsApp adapter
 */
export interface WhatsAppPort {
  sendMessage(options: SendMessageOptions): Promise<Result<void>>;
  sendOtp(options: SendOtpOptions): Promise<Result<void>>;
}
