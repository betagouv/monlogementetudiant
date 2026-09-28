import { describe, expect, it } from 'vitest'
import { classifyGeolocationError, systemLocationSettingsUrl } from './geolocation-settings'

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

describe('systemLocationSettingsUrl', () => {
  it('ouvre les réglages de localisation macOS', () => {
    expect(systemLocationSettingsUrl({ userAgent: MAC_CHROME, maxTouchPoints: 0 })).toMatch(/^x-apple\.systempreferences:/)
  })

  it('ouvre les réglages de localisation Windows', () => {
    expect(systemLocationSettingsUrl({ userAgent: WINDOWS_EDGE, maxTouchPoints: 0 })).toBe('ms-settings:privacy-location')
  })

  it("n'en propose pas sur iPad, qui se présente comme un Mac tactile", () => {
    expect(systemLocationSettingsUrl({ userAgent: MAC_CHROME, maxTouchPoints: 5 })).toBeNull()
  })

  it("n'en propose pas sur mobile", () => {
    expect(systemLocationSettingsUrl({ userAgent: ANDROID, maxTouchPoints: 5 })).toBeNull()
  })
})

describe('classifyGeolocationError', () => {
  it('attribue un refus au système quand le site est autorisé', () => {
    expect(classifyGeolocationError(1, 'granted')).toBe('deniedBySystem')
  })

  it('attribue un refus au site sinon', () => {
    expect(classifyGeolocationError(1, 'denied')).toBe('denied')
    expect(classifyGeolocationError(1, null)).toBe('denied')
  })

  it('renvoie vers les réglages système quand la position est indisponible', () => {
    expect(classifyGeolocationError(2, 'granted')).toBe('deniedBySystem')
  })

  it('traite un délai dépassé comme une indisponibilité', () => {
    expect(classifyGeolocationError(3, 'granted')).toBe('unavailable')
    expect(classifyGeolocationError(undefined, null)).toBe('unavailable')
  })
})
