'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface TableField {
  id: number
  tableId: number
  name: string
  type: string
  order: number
  options: string | null
}

export default function PublicFormPage() {
  const params = useParams()
  const tableId = params?.tableId ? Number(params.tableId) : null

  const [tableName, setTableName] = useState('')
  const [fields, setFields] = useState<TableField[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Custom form view configurations
  const [formViewSettings, setFormViewSettings] = useState<{
    description: string
    activeFieldIds: number[]
    requiredFieldIds: number[]
    submitAction: 'message' | 'redirect'
    successMessage: string
    redirectUrl: string
    placeholders?: Record<number, string>
  } | null>(null)

  // Load custom eye-care settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)

    const savedBrightness = localStorage.getItem('darkreader-brightness')
    const savedContrast = localStorage.getItem('darkreader-contrast')
    const savedSepia = localStorage.getItem('darkreader-sepia')
    const savedGrayscale = localStorage.getItem('darkreader-grayscale')

    const b = savedBrightness ? Number(savedBrightness) : 100
    const c = savedContrast ? Number(savedContrast) : 100
    const s = savedSepia ? Number(savedSepia) : 15
    const g = savedGrayscale ? Number(savedGrayscale) : 0
    
    document.documentElement.style.setProperty('--darkreader-brightness', `${b}%`)
    document.documentElement.style.setProperty('--darkreader-contrast', `${c}%`)
    document.documentElement.style.setProperty('--darkreader-sepia', `${s}%`)
    document.documentElement.style.setProperty('--darkreader-grayscale', `${g}%`)
  }, [])

  useEffect(() => {
    if (!tableId) return

    const loadFormSchema = async () => {
      try {
        const [tableRes, fieldsRes] = await Promise.all([
          fetch(`/api/tables`), // To look up table name
          fetch(`/api/tables/${tableId}/fields`)
        ])
        
        const tables = await tableRes.json()
        const fieldsData = await fieldsRes.json()
        
        const targetTable = tables.find((t: any) => t.id === tableId)
        if (targetTable) {
          setTableName(targetTable.name)
        } else {
          throw new Error('找不到該資料表')
        }

        // Load custom form view settings
        const savedSettings = localStorage.getItem(`form-view-settings-${tableId}`)
        let activeIds: number[] = []
        let requiredIds: number[] = []
        
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings)
            setFormViewSettings(parsed)
            activeIds = parsed.activeFieldIds || []
            requiredIds = parsed.requiredFieldIds || []
          } catch (e) {
            console.error('Failed to parse form settings', e)
          }
        }

        if (Array.isArray(fieldsData)) {
          const submittableFields = fieldsData.filter(f => !['link_row', 'autonumber', 'formula', 'lookup', 'rollup', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))
          
          // If settings exist, filter by activeFieldIds
          const filteredFields = savedSettings 
            ? submittableFields.filter(f => activeIds.includes(f.id))
            : submittableFields

          setFields(filteredFields)
          
          // Set defaults with URL search parameter prefilling support
          const defaults: Record<string, any> = {}
          const hiddenIds: number[] = []

          // Parse search parameters if on client
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

          filteredFields.forEach(f => {
            const key = `field_${f.id}`
            let initialVal: any = ''
            if (f.type === 'boolean') initialVal = false
            else if (f.type === 'number') initialVal = null

            // Check prefill parameters: ?prefill_FieldName=Val or ?prefill_field_123=Val
            if (urlParams) {
              const exactPrefill = urlParams.get(`prefill_${key}`)
              const namePrefill = urlParams.get(`prefill_${f.name}`)
              const pref = exactPrefill ?? namePrefill
              if (pref !== null) {
                if (f.type === 'boolean') initialVal = pref === 'true' || pref === '1'
                else if (f.type === 'number') initialVal = isNaN(Number(pref)) ? null : Number(pref)
                else initialVal = pref
              }

              // Check hide parameters: ?hide_FieldName=true or ?hide_field_123=true
              const exactHide = urlParams.get(`hide_${key}`)
              const nameHide = urlParams.get(`hide_${f.name}`)
              if (exactHide === 'true' || nameHide === 'true' || exactHide === '1' || nameHide === '1') {
                hiddenIds.push(f.id)
              }
            }

            defaults[key] = initialVal
          })

          setFormData(defaults)
          setFormViewSettings(prev => ({
            ...prev,
            description: prev?.description || '',
            activeFieldIds: prev?.activeFieldIds || [],
            requiredFieldIds: prev?.requiredFieldIds || [],
            submitAction: prev?.submitAction || 'message',
            successMessage: prev?.successMessage || '',
            redirectUrl: prev?.redirectUrl || '',
            hiddenFieldIds: hiddenIds
          } as any))
        }
      } catch (err: any) {
        setError(err.message || '載入表單失敗')
      } finally {
        setLoading(false)
      }
    }

    loadFormSchema()
  }, [tableId])

  const handleInputChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tableId) return
    setError(null)

    // Validate required fields
    if (formViewSettings && formViewSettings.requiredFieldIds) {
      for (const reqId of formViewSettings.requiredFieldIds) {
        const field = fields.find(f => f.id === reqId)
        if (field) {
          const key = `field_${field.id}`
          const val = formData[key]
          if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
            setError(`欄位「${field.name}」為必填項目`)
            return
          }
        }
      }
    }

    try {
      const res = await fetch(`/api/tables/${tableId}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData }),
      })
      if (!res.ok) throw new Error('提交失敗')
      
      // If submit action is redirect, perform redirection
      if (formViewSettings && formViewSettings.submitAction === 'redirect' && formViewSettings.redirectUrl) {
        window.location.href = formViewSettings.redirectUrl
        return
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || '無法儲存表單資料')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f23', color: 'white', fontFamily: 'sans-serif' }}>
        <div>載入表單中...</div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f23', color: 'white', fontFamily: 'sans-serif', padding: '20px' }}>
        <div style={{ background: '#1a1a2e', padding: '40px', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          <div style={{ width: '56px', height: '56px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px', fontWeight: 'bold' }}>✓</div>
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>提交成功！</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
            {formViewSettings?.successMessage || `您的資料已成功寫入「${tableName}」資料表中，感謝您的填寫。`}
          </p>
          <button
            onClick={() => {
              setSubmitted(false)
              // Reset values
              const resetData = { ...formData }
              Object.keys(resetData).forEach(k => {
                const f = fields.find(fd => `field_${fd.id}` === k)
                if (f?.type === 'boolean') resetData[k] = false
                else if (f?.type === 'number') resetData[k] = null
                else resetData[k] = ''
              })
              setFormData(resetData)
            }}
            style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          >
            再次填寫
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f23', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: '880px', width: '100%' }}>
        {/* Form Container */}
        <div style={{ background: '#1a1a2e', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.15)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {/* Accent header stripe */}
          <div style={{ height: '8px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)' }} />
          
          <div style={{ padding: '32px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: 'white' }}>{tableName}</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              {formViewSettings?.description || '外部表單收集頁面。您填寫的內容將自動整合入資料庫中。'}
            </p>
            
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '12px', color: '#ef4444', fontSize: '13px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {fields.map(field => {
                if ((formViewSettings as any)?.hiddenFieldIds?.includes(field.id)) {
                  return null
                }

                const key = `field_${field.id}`
                const val = formData[key]
                const options = field.options ? JSON.parse(field.options) : {}
                const isRequired = formViewSettings?.requiredFieldIds?.includes(field.id) || false

                return (
                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                      {field.name} {isRequired && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                    </label>
                    
                    {/* TEXT / EMAIL / URL / PHONE */}
                    {(field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'phone') && (
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
                        value={val == null ? '' : val}
                        onChange={e => handleInputChange(key, e.target.value)}
                        required={isRequired}
                        placeholder={formViewSettings?.placeholders?.[field.id] || ""}
                        style={{ padding: '10px 12px', background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', color: 'white', outline: 'none', transition: 'border-color 0.15s' }}
                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                        onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.15)'}
                      />
                    )}

                    {/* LONG TEXT */}
                    {field.type === 'long_text' && (
                      <textarea
                        rows={4}
                        value={val == null ? '' : val}
                        onChange={e => handleInputChange(key, e.target.value)}
                        required={isRequired}
                        placeholder={formViewSettings?.placeholders?.[field.id] || ""}
                        style={{ padding: '10px 12px', background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', color: 'white', outline: 'none', resize: 'vertical' }}
                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                        onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.15)'}
                      />
                    )}

                    {/* NUMBER */}
                    {field.type === 'number' && (
                      <input
                        type="number"
                        value={val == null ? '' : val}
                        onChange={e => handleInputChange(key, e.target.value === '' ? null : Number(e.target.value))}
                        required={isRequired}
                        placeholder={formViewSettings?.placeholders?.[field.id] || ""}
                        style={{ padding: '10px 12px', background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', color: 'white', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                        onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.15)'}
                      />
                    )}

                    {/* DATE */}
                    {field.type === 'date' && (
                      <input
                        type="date"
                        value={val == null ? '' : val}
                        onChange={e => handleInputChange(key, e.target.value)}
                        required={isRequired}
                        style={{ padding: '10px 12px', background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', color: 'white', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                        onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.15)'}
                      />
                    )}

                    {/* BOOLEAN */}
                    {field.type === 'boolean' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={e => handleInputChange(key, e.target.checked)}
                          required={isRequired}
                          id={`form_chk_${field.id}`}
                          style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                        />
                        <label htmlFor={`form_chk_${field.id}`} style={{ fontSize: '13px', color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                          是 / 同意
                        </label>
                      </div>
                    )}

                    {/* SINGLE SELECT */}
                    {field.type === 'single_select' && (
                      <select
                        value={val == null ? '' : val}
                        onChange={e => handleInputChange(key, e.target.value)}
                        required={isRequired}
                        style={{ padding: '10px 12px', background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', color: 'white', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="">（未選擇）</option>
                        {options.choices?.map((c: string) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}

              <button
                type="submit"
                style={{ marginTop: '12px', padding: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}
              >
                提交表單
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
