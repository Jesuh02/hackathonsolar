export interface SendOtpRequest {
  phone: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  verified: boolean;
  phone: string;
}

export interface WhatsAppVerificationState {
  isVerified: boolean;
  phone: string | null;
}
