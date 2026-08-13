import React from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'

interface RollupLookupFieldOptionsProps {
  type: string
  relationFieldId: number | null
  setRelationFieldId: (id: number | null) => void
  targetFieldId: number | null
  setTargetFieldId: (id: number | null) => void
  rollupFunction: string
  setRollupFunction: (func: string) => void
  fields: any[]
  fetchedTargetFields: any[]
}

export function RollupLookupFieldOptions({
  type,
  relationFieldId,
  setRelationFieldId,
  targetFieldId,
  setTargetFieldId,
  rollupFunction,
  setRollupFunction,
  fields,
  fetchedTargetFields
}: RollupLookupFieldOptionsProps) {
  const { t } = useI18n()
  
  return (
    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
          {t('fieldModal.relationField')}
        </label>
        <select
          value={relationFieldId || ''}
          onChange={(e) => {
            setRelationFieldId(Number(e.target.value) || null)
            setTargetFieldId(null)
          }}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="">{t('fieldModal.selectRelationField')}</option>
          {fields?.filter(f => f.type === 'link_row').map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
          {t('fieldModal.targetField')}
        </label>
        <select
          value={targetFieldId || ''}
          onChange={(e) => setTargetFieldId(Number(e.target.value) || null)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
          disabled={!relationFieldId || fetchedTargetFields.length === 0}
        >
          <option value="">{t('fieldModal.selectTargetField')}</option>
          {fetchedTargetFields.map((f: any) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {type === 'rollup' && (
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
            {t('fieldModal.rollupFunction')}
          </label>
          <select
            value={rollupFunction}
            onChange={(e) => setRollupFunction(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
          >
            <option value="sum">Sum</option>
            <option value="avg">Avg</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
            <option value="count">Count</option>
            <option value="concat">Concat</option>
          </select>
        </div>
      )}
    </div>
  )
}
