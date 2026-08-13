import React from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'

interface FieldModalHeaderProps {
  activeTab: 'basic' | 'advanced'
  setActiveTab: (tab: 'basic' | 'advanced') => void
}

export function FieldModalHeader({ activeTab, setActiveTab }: FieldModalHeaderProps) {
  const { t } = useI18n()
  
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => setActiveTab('basic')}
        style={{
          padding: '8px 16px',
          border: 'none',
          background: 'none',
          fontWeight: activeTab === 'basic' ? 600 : 400,
          color: activeTab === 'basic' ? '#18181B' : '#71717A',
          borderBottom: activeTab === 'basic' ? '2px solid #18181B' : '2px solid transparent',
          marginBottom: '-1px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        {t('fieldModal.basicTab')}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('advanced')}
        style={{
          padding: '8px 16px',
          border: 'none',
          background: 'none',
          fontWeight: activeTab === 'advanced' ? 600 : 400,
          color: activeTab === 'advanced' ? '#18181B' : '#71717A',
          borderBottom: activeTab === 'advanced' ? '2px solid #18181B' : '2px solid transparent',
          marginBottom: '-1px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        {t('fieldModal.advancedTab')}
      </button>
    </div>
  )
}
