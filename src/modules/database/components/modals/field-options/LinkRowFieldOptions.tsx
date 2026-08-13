import React from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'

interface LinkRowFieldOptionsProps {
  targetTableId: number | null
  setTargetTableId: (id: number | null) => void
  tables: Array<{ id: number; name: string }>
  createRelatedField: boolean
  setCreateRelatedField: (val: boolean) => void
  allowMultiple: boolean
  setAllowMultiple: (val: boolean) => void
}

export function LinkRowFieldOptions({
  targetTableId,
  setTargetTableId,
  tables,
  createRelatedField,
  setCreateRelatedField,
  allowMultiple,
  setAllowMultiple
}: LinkRowFieldOptionsProps) {
  const { t } = useI18n()
  
  return (
    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
          {t('fieldModal.targetField')}
        </label>
        <select
          value={targetTableId || ''}
          onChange={(e) => setTargetTableId(Number(e.target.value) || null)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="">{t('fieldModal.selectTable')}</option>
          {tables?.map((tbl) => (
            <option key={tbl.id} value={tbl.id}>{tbl.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={createRelatedField}
            onChange={(e) => setCreateRelatedField(e.target.checked)}
            style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer' }}
          />
          <span>{t('fieldModal.createReverseLink')}</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer' }}
          />
          <span>{t('fieldModal.allowMultipleLinked')}</span>
        </label>
      </div>
    </div>
  )
}
