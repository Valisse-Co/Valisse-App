export const VERIFY_EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const SECURITY_TOKEN_MIN_LENGTH = 30;
export const SECURITY_TOKEN_MAX_LENGTH = 256;
export const PASSWORD_MIN_CHARACTERS = 8;
export const PASSWORD_MAX_UTF8_BYTES = 72;

export type EmailVerificationState = {
  emailVerificationRequired?: boolean | null;
  emailVerifiedAt?: Date | string | number | null;
};

export function requiresEmailVerification(
  user: EmailVerificationState | null | undefined
): boolean {
  return Boolean(user?.emailVerificationRequired && !user.emailVerifiedAt);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Shared by registration, password recovery, and browser validation. bcrypt
// silently truncates beyond 72 UTF-8 bytes; reject instead of truncating.
export function getPasswordValidationError(password: string): string | null {
  if (Array.from(password).length < PASSWORD_MIN_CHARACTERS) {
    return "Password must contain at least 8 characters.";
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_UTF8_BYTES) {
    return "Password must be no more than 72 UTF-8 bytes.";
  }
  return null;
}

export function isValidPassword(password: string): boolean {
  return getPasswordValidationError(password) === null;
}
