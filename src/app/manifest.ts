import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '北科伙食團 FYCD HD Manager',
    short_name: 'FYCD HD',
    description: '全功能雲端資料庫管理平台，提供動態資料表、多維檢視表與團隊協作。',
    start_url: '/',
    display: 'standalone',
    // Android 啟動畫面底色，與品牌載入層的米白一致
    background_color: '#F5F0E6',
    theme_color: '#39452B',
    orientation: 'any',
    // 圖示由 scripts/generate-brand-icons.mjs 產生
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
  }
}
