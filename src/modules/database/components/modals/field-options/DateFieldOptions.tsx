import React, { useId, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'
import type { DateFormat, DateOptions } from '@/modules/database/utils/dateTime'

interface DateFieldOptionsProps {
  value: DateOptions
  onChange: (next: DateOptions) => void
  fieldType: string
}

const FORMATS: Array<{ value: DateFormat; key: string }> = [
  { value: 'local', key: 'modals.dateFormatLocal' },
  { value: 'friendly', key: 'modals.dateFormatFriendly' },
  { value: 'us', key: 'modals.dateFormatUs' },
  { value: 'european', key: 'modals.dateFormatEuropean' },
  { value: 'iso', key: 'modals.dateFormatIso' },
]

function listTimeZones(current: string): string[] {
  let zones: string[] = ['UTC', 'Asia/Taipei']
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
    if (supported && supported.length > 0) zones = supported
  } catch {
    // keep fallback
  }
  const set = new Set(zones)
  set.add('UTC')
  set.add('Asia/Taipei')
  if (current && current !== 'client') set.add(current)
  return Array.from(set)
}

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff' }
const checkLabelStyle: React.CSSProperties = { fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }

export function DateFieldOptions({ value, onChange, fieldType }: DateFieldOptionsProps) {
  const { t } = useI18n()
  const id = useId()
  const zones = useMemo(() => listTimeZones(value.date_time_zone), [value.date_time_zone])
  const patch = (next: Partial<DateOptions>) => onChange({ ...value, ...next })

  return (
    <div
      data-field-type={fieldType}
      style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
        {t('modals.dateOptions')}
      </div>
      <div>
        <label htmlFor={`${id}-format`} style={labelStyle}>{t('modals.dateFormat')}</label>
        <select
          id={`${id}-format`}
          value={value.date_format}
          onChange={(e) => patch({ date_format: e.target.value as DateFormat })}
          style={selectStyle}
        >
          {FORMATS.map(f => (
            <option key={f.value} value={f.value}>{t(f.key)}</option>
          ))}
        </select>
      </div>
      <label htmlFor={`${id}-time`} style={checkLabelStyle}>
        <input
          id={`${id}-time`}
          type="checkbox"
          checked={value.date_include_time}
          onChange={(e) => patch({ date_include_time: e.target.checked })}
        />
        {t('modals.includeTime')}
      </label>
      {value.date_include_time && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor={`${id}-timefmt`} style={labelStyle}>{t('modals.timeFormat')}</label>
              <select
                id={`${id}-timefmt`}
                value={value.date_time_format}
                onChange={(e) => patch({ date_time_format: e.target.value === '12' ? '12' : '24' })}
                style={selectStyle}
              >
                <option value="24">{t('modals.timeFormat24')}</option>
                <option value="12">{t('modals.timeFormat12')}</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-zone`} style={labelStyle}>{t('modals.timeZone')}</label>
              <select
                id={`${id}-zone`}
                value={value.date_time_zone}
                onChange={(e) => patch({ date_time_zone: e.target.value })}
                style={selectStyle}
              >
                <option value="client">{t('modals.timeZoneClient')}</option>
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>
          <label htmlFor={`${id}-showzone`} style={checkLabelStyle}>
            <input
              id={`${id}-showzone`}
              type="checkbox"
              checked={value.date_show_time_zone}
              onChange={(e) => patch({ date_show_time_zone: e.target.checked })}
            />
            {t('modals.showTimeZone')}
          </label>
        </>
      )}
    </div>
  )
}
