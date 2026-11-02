export type ChangelogCategory = 'feature' | 'improvement' | 'fix' | 'security'

export interface ChangelogItem {
  type: ChangelogCategory
  text: string
}

export interface VersionRelease {
  version: string
  releaseDate: string
  title?: string
  isLatest?: boolean
  items: ChangelogItem[]
}

export const APP_CURRENT_VERSION = 'v1.1.0'

export const CHANGELOG_RELEASES: VersionRelease[] = [
  {
    version: 'v1.1.0',
    releaseDate: '2026-11-02',
    title: '版本紀錄與自動發布通知系統',
    isLatest: true,
    items: [
      { type: 'feature', text: '新增版本更新紀錄彈窗，支援隨時查閱歷史更新' },
      { type: 'feature', text: '實裝新版本自動檢測與即時更新提醒通知' },
      { type: 'improvement', text: '輕量定時與視窗聚焦背景檢測，無額外資料庫負擔' },
      { type: 'improvement', text: '側邊欄使用者選單支援一鍵開啟版本紀錄' },
    ],
  },
  {
    version: 'v1.0.5',
    releaseDate: '2026-10-28',
    title: '首頁總覽現代化改版與側邊欄體驗升級',
    items: [
      { type: 'feature', text: '實裝 Forest Land Glassmorphism UI 總覽頁面，支援雙模式切換' },
      { type: 'improvement', text: '側邊欄升級仿 Claude 網頁版互動：0px 收合、懸停浮出、Ctrl+B 快捷鍵' },
      { type: 'fix', text: '完整修復 Airtable 匯入引擎與 link_row 二階段回填關聯' },
    ],
  },
  {
    version: 'v1.0.0',
    releaseDate: '2026-10-18',
    title: 'FYCD HD Manager 正式版本發布',
    items: [
      { type: 'feature', text: '多工作區、資料庫與資料表管理' },
      { type: 'feature', text: '豐富欄位型別支援（文字、數字、單/多選、關聯、公式、查閱等）' },
      { type: 'feature', text: '多人即時協作與 RBAC 權限管理' },
    ],
  },
]
