'use client'

import React, { useState } from 'react'

interface TableField {
  id: number
  tableId: number
  name: string
  type: string
  order: number
  options: string | null
}

interface FormViewProps {
  tableId: number
  tableName: string
  fields: TableField[]
}

interface FormSettings {
  description: string
  activeFieldIds: number[]
  requiredFieldIds: number[]
  submitAction: 'message' | 'redirect'
  successMessage: string
  redirectUrl: string
  placeholders?: Record<number, string>
}

export default function FormView({
  tableId,
  tableName,
  fields,
}: FormViewProps) {
  const submittableFieldIds = fields
    .filter(f => !['link_row', 'autonumber', 'formula', 'lookup', 'rollup', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))
    .map(f => f.id)

  const [settings, setSettings] = useState<FormSettings>(() => {
    const defaults: FormSettings = {
      description: '請填寫以下表單以提交資料。',
      activeFieldIds: submittableFieldIds,
      requiredFieldIds: [],
      submitAction: 'message',
      successMessage: '感謝您的填寫！資料已成功送出。',
      redirectUrl: ''
    }

    if (typeof window === 'undefined') return defaults

    const saved = localStorage.getItem(`form-view-settings-${tableId}`)
    if (!saved) return defaults

    try {
      const parsed = JSON.parse(saved)
      return {
        description: parsed.description ?? defaults.description,
        activeFieldIds: parsed.activeFieldIds ?? defaults.activeFieldIds,
        requiredFieldIds: parsed.requiredFieldIds ?? defaults.requiredFieldIds,
        submitAction: parsed.submitAction ?? defaults.submitAction,
        successMessage: parsed.successMessage ?? defaults.successMessage,
        redirectUrl: parsed.redirectUrl ?? defaults.redirectUrl
      }
    } catch {
      return defaults
    }
  })

  const saveSettings = (newSettings: FormSettings) => {
    setSettings(newSettings)
    localStorage.setItem(`form-view-settings-${tableId}`, JSON.stringify(newSettings))
  }

  // Toggle field visibility on form
  const handleToggleFieldActive = (fieldId: number) => {
    let updatedActive = [...settings.activeFieldIds]
    if (updatedActive.includes(fieldId)) {
      updatedActive = updatedActive.filter(id => id !== fieldId)
    } else {
      updatedActive.push(fieldId)
    }
    saveSettings({ ...settings, activeFieldIds: updatedActive })
  }

  // Toggle field required state on form
  const handleToggleFieldRequired = (fieldId: number) => {
    let updatedRequired = [...settings.requiredFieldIds]
    if (updatedRequired.includes(fieldId)) {
      updatedRequired = updatedRequired.filter(id => id !== fieldId)
    } else {
      updatedRequired.push(fieldId)
    }
    saveSettings({ ...settings, requiredFieldIds: updatedRequired })
  }

  const submittableFields = fields.filter(f => !['link_row', 'autonumber', 'formula', 'lookup', 'rollup', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', overflow: 'hidden', background: 'var(--bg-primary)', width: '100%' }}>
      {/* Left panel: Fields list configuration */}
      <div 
        style={{ 
          width: '280px', 
          borderRight: '1px solid var(--border-color)', 
          background: 'var(--bg-secondary)', 
          display: 'flex', 
          flexDirection: 'column', 
          flexShrink: 0 
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>表單欄位設定</h4>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>選擇要加入此公開表單的欄位：</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {submittableFields.map(field => {
            const isActive = settings.activeFieldIds.includes(field.id)
            return (
              <div 
                key={field.id}
                onClick={() => handleToggleFieldActive(field.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.2)' : 'var(--border-color)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {}} // Controlled by outer div onClick
                    style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--accent-primary)' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {field.name}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {field.type}
                </span>
              </div>
            )
          })}
          {submittableFields.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              此表尚無可填寫欄位
            </div>
          )}
        </div>

        {/* Dynamic tips box */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '8px', padding: '12px' }}>
            <span style={{ fontSize: '15px', color: 'var(--accent-secondary)' }}>💡</span>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong>您知道嗎？</strong> 您可以藉由公開表單網址 prefill 參數（例如 <code>?prefill_欄位名=內容</code>）來預先填寫或隱藏特定表單欄位！
            </div>
          </div>
        </div>
      </div>

      {/* Center panel: Live interactive form preview */}
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '100%', 
            maxWidth: '880px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Form Header area */}
          <div style={{ padding: '28px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {tableName}
            </h2>
            <textarea
              value={settings.description}
              onChange={e => saveSettings({ ...settings, description: e.target.value })}
              placeholder="請填寫表單說明描述..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px dashed transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                marginTop: '12px',
                padding: '4px 0',
                resize: 'none',
                height: '48px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
              onFocus={e => e.currentTarget.style.borderBottomColor = 'var(--text-muted)'}
              onBlur={e => e.currentTarget.style.borderBottomColor = 'transparent'}
            />
          </div>

          {/* Form Fields preview */}
          <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {submittableFields.filter(f => settings.activeFieldIds.includes(f.id)).map(field => {
              const isRequired = settings.requiredFieldIds.includes(field.id)
              return (
                <div 
                  key={field.id}
                  style={{ 
                    padding: '16px', 
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: '13px', userSelect: 'none' }} title="拖曳排序">⋮⋮</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {field.name} {isRequired && <span style={{ color: 'var(--danger)' }}>*</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={isRequired}
                          onChange={() => handleToggleFieldRequired(field.id)}
                          style={{ cursor: 'pointer', width: '12px', height: '12px', accentColor: 'var(--accent-primary)' }}
                        />
                        必填
                      </label>
                      <button
                        onClick={() => handleToggleFieldActive(field.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                        title="自表單隱藏"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <input
                    value={settings.placeholders?.[field.id] || ''}
                    onChange={e => {
                      const updated = { ...(settings.placeholders || {}), [field.id]: e.target.value }
                      saveSettings({ ...settings, placeholders: updated })
                    }}
                    placeholder={`輸入「${field.name}」的輸入提示文字 (Placeholder)...`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
              )
            })}

            {settings.activeFieldIds.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                目前沒有啟用的欄位，請在左側面板勾選以顯示。
              </div>
            )}

            {/* Mock Submit button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                disabled 
                style={{ 
                  padding: '10px 24px', 
                  borderRadius: '8px', 
                  background: 'var(--accent-gradient)', 
                  color: 'white', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  border: 'none',
                  opacity: 0.8
                }}
              >
                提交資料
              </button>
            </div>
          </div>

          {/* Branding footer mockup */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
              ⚡ Powered by Baserow
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
              檢舉不當表單
            </span>
          </div>
        </div>

        {/* Success Settings panel */}
        <div 
          style={{ 
            width: '100%', 
            maxWidth: '560px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            marginTop: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            提交成功後續動作設定
          </h4>

          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="submitAction"
                checked={settings.submitAction === 'message'}
                onChange={() => saveSettings({ ...settings, submitAction: 'message' })}
                style={{ cursor: 'pointer', width: '13px', height: '13px' }}
              />
              顯示感謝訊息
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="submitAction"
                checked={settings.submitAction === 'redirect'}
                onChange={() => saveSettings({ ...settings, submitAction: 'redirect' })}
                style={{ cursor: 'pointer', width: '13px', height: '13px' }}
              />
              重新導向至外部網址 (URL)
            </label>
          </div>

          {settings.submitAction === 'message' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>成功訊息內容</label>
              <textarea
                value={settings.successMessage}
                onChange={e => saveSettings({ ...settings, successMessage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '60px',
                  outline: 'none'
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>導向網址連結 (URL)</label>
              <input
                type="text"
                placeholder="https://example.com/thank-you"
                value={settings.redirectUrl}
                onChange={e => saveSettings({ ...settings, redirectUrl: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
