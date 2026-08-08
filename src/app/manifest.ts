import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '北科伙食團 FYCD HD Manager',
    short_name: 'FYCD HD',
    description: '全功能雲端資料庫管理平台，提供動態資料表、多維檢視表與團隊協作。',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#EA580C',
    orientation: 'any',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
}
