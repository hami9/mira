// احراز هویت دومرحله‌ای اپراتور (فاز ۶) — TOTP استاندارد (Google Authenticator و مشابه)
export interface TwoFactorSetupResponseDto {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface VerifyTwoFactorSetupDto {
  code: string;
}

export interface TwoFactorStatusDto {
  enabled: boolean;
}

// وقتی 2FA فعاله، login اول این توکن کوتاه‌عمر رو برمی‌گردونه (نه accessToken واقعی)؛
// کلاینت باید کد TOTP رو با همین توکن به /v1/auth/2fa/verify-login بفرسته
export interface TwoFactorLoginDto {
  twoFactorToken: string;
  code: string;
}
