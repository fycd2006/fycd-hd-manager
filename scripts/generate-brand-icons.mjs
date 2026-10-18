#!/usr/bin/env node
// 產生 PWA 圖示與 iOS 啟動圖到 public/brand/（手動執行，不在 verify 內）。
// 以本機 Edge／Chrome headless 截圖渲染；可用 BROWSER_PATH 指定瀏覽器。
// 字標路徑需與 src/components/brand/FycdLogo.tsx 一致；
// SPLASH 清單需與 src/lib/brand/splashScreens.ts 一致（由測試比對）。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'brand')

const IVORY = '#F5F0E6'

// [CSS 寬, CSS 高, DPR]
const SPLASH = [
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 667, 2],
  [744, 1133, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
]

const ICONS = [
  { file: 'icon-192.png', size: 192, widthPct: 70 },
  { file: 'icon-512.png', size: 512, widthPct: 70 },
  { file: 'maskable-512.png', size: 512, widthPct: 56 },
  { file: 'apple-touch-icon.png', size: 180, widthPct: 70 },
]

const FYCD_PATHS = [
  'M0 0H82V25H27V39H66V62H27V100H0Z',
  'M86 0H116L130 31L144 0H174L143 57V100H116V57Z',
  'M272 0H228C198 0 180 19 180 47V53C180 81 198 100 228 100H272V75H232C215 75 207 67 207 53V47C207 33 215 25 232 25H272Z',
  'M278 0H330C358 0 377 19 377 47V53C377 81 358 100 330 100H278ZM305 25V75H326C342 75 350 67 350 53V47C350 33 342 25 326 25Z',
]
const HD_PATHS = [
  'M0 0H29V37H67V0H96V100H67V63H29V100H0Z',
  'M104 0H156C190 0 210 21 210 50C210 79 190 100 156 100H104ZM133 26V74H153C171 74 181 64 181 50C181 36 171 26 153 26Z',
]

const paths = list => list.map(d => `<path d="${d}" fill-rule="evenodd"/>`).join('')

function logoSvg(variant) {
  const viewBox = variant === 'icon' ? '400 -30 312 136' : '8 -30 704 136'
  const fycd = variant === 'full'
    ? `<g fill="#39452B" stroke="#39452B" stroke-width="3" stroke-linejoin="round">${paths(FYCD_PATHS)}</g>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="width:100%;height:auto;display:block">
<defs><linearGradient id="fold" x1="0" y1="0" x2="1" y2="1"><stop offset="0.5" stop-color="#F58220"/><stop offset="0.5" stop-color="#DD6410"/></linearGradient></defs>
<g transform="translate(46 0) skewX(-17)">${fycd}
<g transform="translate(392 -24) scale(1.24)" fill="url(#fold)" stroke="url(#fold)" stroke-width="2.4" stroke-linejoin="round">${paths(HD_PATHS)}</g>
</g></svg>`
}

function page(svg, widthPx) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:${IVORY};overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
.logo{width:${widthPx}px}
</style></head><body><div class="logo">${svg}</div></body></html>`
}

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  const found = candidates.find(p => fs.existsSync(p))
  if (!found) {
    console.error('找不到 Edge／Chrome，請以 BROWSER_PATH 指定瀏覽器執行檔路徑。')
    process.exit(1)
  }
  return found
}

function render(browser, html, width, height, outFile, scale = 1) {
  const tmp = path.join(os.tmpdir(), `fycd-brand-${process.pid}-${path.basename(outFile)}.html`)
  fs.writeFileSync(tmp, html)
  try {
    execFileSync(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outFile}`,
      pathToFileURL(tmp).href,
    ], { stdio: 'ignore' })
  } finally {
    fs.rmSync(tmp, { force: true })
  }
  if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
    console.error(`渲染失敗：${outFile}`)
    process.exit(1)
  }
  console.log(`✓ ${path.relative(root, outFile)}`)
}

const browser = findBrowser()
fs.mkdirSync(outDir, { recursive: true })

// headless 視窗有最小寬度，小圖示以 512 視窗排版、再以 DPR 縮到目標像素
const ICON_CANVAS = 512
for (const icon of ICONS) {
  const html = page(logoSvg('icon'), Math.round(ICON_CANVAS * icon.widthPct / 100))
  render(browser, html, ICON_CANVAS, ICON_CANVAS, path.join(outDir, icon.file), icon.size / ICON_CANVAS)
}

for (const [w, h, dpr] of SPLASH) {
  const pw = w * dpr
  const ph = h * dpr
  const html = page(logoSvg('full'), Math.round(Math.min(pw, ph) * 0.5))
  render(browser, html, pw, ph, path.join(outDir, `splash-${pw}x${ph}.png`))
}
