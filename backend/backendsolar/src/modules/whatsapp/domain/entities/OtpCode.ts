/**
 * OtpCode entity - represents a one-time password with expiration
 */
export class OtpCode {
  readonly phone: string;
  readonly code: string;
  readonly expiresAt: Date;
  readonly attempts: number;

  private constructor(phone: string, code: string, expiresAt: Date, attempts = 0) {
    this.phone = phone;
    this.code = code;
    this.expiresAt = expiresAt;
    this.attempts = attempts;
  }

  static create(phone: string, ttlSeconds = 600): OtpCode {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return new OtpCode(phone, code, expiresAt);
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isValid(inputCode: string): boolean {
    return !this.isExpired() && this.code === inputCode && this.attempts < 5;
  }

  withIncrementedAttempts(): OtpCode {
    return new OtpCode(this.phone, this.code, this.expiresAt, this.attempts + 1);
  }
}
