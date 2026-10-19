'use client'

import React from 'react'
import { FycdLogo } from '@/components/brand/FycdLogo'
import { useI18n } from '@/lib/i18n/i18nContext'
import styles from './AppShellSkeleton.module.css'

const SIDEBAR_WIDTHS = [85, 65, 75, 55, 80]
const TOOLBAR_WIDTHS = [110, 75, 75]
const GRID_ROWS = 8 // 表頭 + 7 列
const GRID_COLS = 5

/**
 * 首屏骨架（SSR 時 authLoading 為 true 就會畫出）。
 * 配色依 html[data-theme] 切換，首次繪製即與使用者主題一致；版面對齊真實 app（<1024px 無側欄）。
 */
export default function AppShellSkeleton() {
  const { t } = useI18n()
  return (
    <div className={styles.root} role="status" aria-busy="true" aria-label={t('auth.loadingWorkspace')}>
      <div className={styles.topLine} aria-hidden="true" />
      <div className={styles.sidebar} data-part="sidebar" aria-hidden="true">
        <div className={styles.sidebarBrand}>
          <FycdLogo variant="icon" height={24} />
          <div className="fycd-skeleton" style={{ width: 110, height: 16, borderRadius: 4 }} />
        </div>
        <div className={styles.sidebarList}>
          {SIDEBAR_WIDTHS.map((w, i) => (
            <div key={i} className="fycd-skeleton" style={{ width: `${w}%`, height: 16, borderRadius: 4 }} />
          ))}
        </div>
      </div>
      <div className={styles.main} aria-hidden="true">
        <div className={styles.toolbar} data-part="toolbar">
          {TOOLBAR_WIDTHS.map((w, i) => (
            <div key={i} className="fycd-skeleton" style={{ width: w, height: 22, borderRadius: 6 }} />
          ))}
        </div>
        <div className={styles.grid}>
          {Array.from({ length: GRID_ROWS }, (_, row) => (
            <div key={row} className={row === 0 ? styles.gridHead : styles.gridRow} data-part="grid-row">
              {Array.from({ length: GRID_COLS }, (_, col) => (
                <div key={col} className={`fycd-skeleton ${styles.cell}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
