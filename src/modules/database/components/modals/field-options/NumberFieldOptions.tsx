import React from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'

interface NumberFieldOptionsProps {
  numberDecimalPlaces: number
  setNumberDecimalPlaces: (val: number) => void
  numberFormat: string
  setNumberFormat: (val: string) => void
  numberPrefix: string
  setNumberPrefix: (val: string) => void
  numberSuffix: string
  setNumberSuffix: (val: string) => void
}

export function NumberFieldOptions({
  numberDecimalPlaces,
  setNumberDecimalPlaces,
  numberFormat,
  setNumberFormat,
  numberPrefix,
  setNumberPrefix,
  numberSuffix,
  setNumberSuffix
}: NumberFieldOptionsProps) {
  const { t } = useI18n()
  
  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
        {t('modals.numberOptions')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
            {t('modals.decimalPlaces')}
          </label>
          <select
            value={numberDecimalPlaces}
            onChange={(e) => setNumberDecimalPlaces(Number(e.target.value))}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff' }}
          >
            <option value={0}>0 (整數 1234)</option>
            <option value={1}>1 (1234.5)</option>
            <option value={2}>2 (1234.56)</option>
            <option value={3}>3 (1234.567)</option>
            <option value={4}>4 (1234.5678)</option>
            <option value={5}>5 (1234.56789)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
            {t('modals.format')}
          </label>
          <select
            value={numberFormat}
            onChange={(e) => setNumberFormat(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff' }}
          >
            <option value="thousands">{t('modals.thousandsSeparator')}</option>
            <option value="standard">{t('modals.standardNumber')}</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
            前綴單位 (Prefix, 如 $, NT$)
          </label>
          <input
            type="text"
            value={numberPrefix}
            onChange={(e) => setNumberPrefix(e.target.value)}
            placeholder="如 $, NT$"
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
            後綴單位 (Suffix, 如 %, 元)
          </label>
          <input
            type="text"
            value={numberSuffix}
            onChange={(e) => setNumberSuffix(e.target.value)}
            placeholder="如 %, 元, kg"
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}
