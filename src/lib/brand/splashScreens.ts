/**
 * iOS PWA 啟動圖尺寸（直向，CSS 寬高＋DPR）。
 * 與 scripts/generate-brand-icons.mjs 的 SPLASH 清單需保持一致（由測試比對）。
 */
export interface SplashScreen {
  width: number
  height: number
  dpr: number
}

export const SPLASH_SCREENS: SplashScreen[] = [
  { width: 430, height: 932, dpr: 3 }, // iPhone 14/15 Pro Max
  { width: 393, height: 852, dpr: 3 }, // iPhone 14/15 Pro
  { width: 428, height: 926, dpr: 3 }, // iPhone 12–14 Pro Max / Plus
  { width: 390, height: 844, dpr: 3 }, // iPhone 12–14
  { width: 375, height: 812, dpr: 3 }, // iPhone X / XS / 11 Pro
  { width: 414, height: 896, dpr: 3 }, // iPhone XS Max / 11 Pro Max
  { width: 414, height: 896, dpr: 2 }, // iPhone XR / 11
  { width: 375, height: 667, dpr: 2 }, // iPhone 8 / SE
  { width: 744, height: 1133, dpr: 2 }, // iPad mini
  { width: 820, height: 1180, dpr: 2 }, // iPad Air
  { width: 834, height: 1194, dpr: 2 }, // iPad Pro 11"
  { width: 1024, height: 1366, dpr: 2 }, // iPad Pro 12.9"
]

export function splashFileName(s: SplashScreen): string {
  return `splash-${s.width * s.dpr}x${s.height * s.dpr}.png`
}

export function toStartupImages(): { url: string; media: string }[] {
  return SPLASH_SCREENS.map(s => ({
    url: `/brand/${splashFileName(s)}`,
    media: `(device-width: ${s.width}px) and (device-height: ${s.height}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`,
  }))
}
