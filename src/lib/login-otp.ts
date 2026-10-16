export const LOGIN_OTP_LENGTH = 6
export const LOGIN_OTP_ALLOWED_ATTEMPTS = 3

export const loginOtpIdentifier = (email: string): string => `sign-in-otp-${email}`
