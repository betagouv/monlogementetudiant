export type GeolocationFailure = 'denied' | 'deniedBySystem' | 'unavailable'

const MACOS_LOCATION_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices'
const WINDOWS_LOCATION_SETTINGS = 'ms-settings:privacy-location'

export const systemLocationSettingsUrl = ({ userAgent, maxTouchPoints }: { userAgent: string; maxTouchPoints: number }) => {
  if (/Windows/.test(userAgent)) return WINDOWS_LOCATION_SETTINGS
  if (/Macintosh/.test(userAgent) && maxTouchPoints <= 1) return MACOS_LOCATION_SETTINGS
  return null
}

export const classifyGeolocationError = (code: number | undefined, sitePermission: PermissionState | null): GeolocationFailure => {
  if (code === 1) return sitePermission === 'granted' ? 'deniedBySystem' : 'denied'
  if (code === 2) return 'deniedBySystem'
  return 'unavailable'
}
