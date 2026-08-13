import React, { RefObject } from 'react'
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n/i18nContext'
import { getSupportedFunctions } from '@/lib/formula'

interface FormulaFieldOptionsProps {
  formula: string
  setFormula: (val: string) => void
  formulaSyntaxError: string
  formulaTextareaRef: RefObject<HTMLTextAreaElement | null>
  insertAtCursor: (text: string, cursorOffsetFromEnd?: number) => void
  formulaTab: 'fields' | 'functions' | 'operators'
  setFormulaTab: (tab: 'fields' | 'functions' | 'operators') => void
  fields: any[]
  functionSearch: string
  setFunctionSearch: (val: string) => void
  activeHoverFunc: { name: string; doc: string; snippet: string; category?: string } | null
  setActiveHoverFunc: (func: { name: string; doc: string; snippet: string; category?: string } | null) => void
  selectedHelpFunc: { name: string; doc: string; snippet: string; category?: string } | null
  setSelectedHelpFunc: (func: { name: string; doc: string; snippet: string; category?: string } | null) => void
}

export function FormulaFieldOptions({
  formula,
  setFormula,
  formulaSyntaxError,
  formulaTextareaRef,
  insertAtCursor,
  formulaTab,
  setFormulaTab,
  fields,
  functionSearch,
  setFunctionSearch,
  activeHoverFunc,
  setActiveHoverFunc,
  selectedHelpFunc,
  setSelectedHelpFunc
}: FormulaFieldOptionsProps) {
  const { t, locale } = useI18n()
  
  return (
    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
          {t('fieldModal.formulaExpression')}
        </label>
        {formula.trim() && (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            background: formulaSyntaxError ? '#fee2e2' : '#dcfce7',
            color: formulaSyntaxError ? '#991b1b' : '#166534',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {formulaSyntaxError ? (
              <>
                <AlertCircle size={13} style={{ color: '#ef4444' }} />
                <span>{t('fieldModal.formulaSyntaxError', { error: formulaSyntaxError })}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} style={{ color: '#166534' }} />
                <span>{t('fieldModal.formulaSyntaxValid')}</span>
              </>
            )}
          </span>
        )}
      </div>

      <textarea
        ref={formulaTextareaRef}
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        placeholder={t('fieldModal.formulaPlaceholder')}
        rows={3}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: formulaSyntaxError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
          borderRadius: '6px',
          fontSize: '13px',
          fontFamily: 'monospace',
          background: '#f8fafc',
          color: '#0f172a',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />

      {/* Formula Explorer & Library Panel */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', background: '#ffffff' }}>
        {/* Explorer Tabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px' }}>
          <button
            type="button"
            onClick={() => setFormulaTab('fields')}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: formulaTab === 'fields' ? '#ffffff' : 'transparent',
              fontWeight: formulaTab === 'fields' ? 600 : 400,
              color: formulaTab === 'fields' ? '#3F6212' : '#64748b',
              borderBottom: formulaTab === 'fields' ? '2px solid #3F6212' : 'none',
              cursor: 'pointer'
            }}
          >
            {t('fieldModal.availableFields')}
          </button>
          <button
            type="button"
            onClick={() => setFormulaTab('functions')}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: formulaTab === 'functions' ? '#ffffff' : 'transparent',
              fontWeight: formulaTab === 'functions' ? 600 : 400,
              color: formulaTab === 'functions' ? '#3F6212' : '#64748b',
              borderBottom: formulaTab === 'functions' ? '2px solid #3F6212' : 'none',
              cursor: 'pointer'
            }}
          >
            {t('fieldModal.formulaFunctions')}
          </button>
          <button
            type="button"
            onClick={() => setFormulaTab('operators')}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: formulaTab === 'operators' ? '#ffffff' : 'transparent',
              fontWeight: formulaTab === 'operators' ? 600 : 400,
              color: formulaTab === 'operators' ? '#3F6212' : '#64748b',
              borderBottom: formulaTab === 'operators' ? '2px solid #3F6212' : 'none',
              cursor: 'pointer'
            }}
          >
            {t('fieldModal.operators')}
          </button>
        </div>

        {/* Explorer Tab Content */}
        <div style={{ padding: '8px 12px', maxHeight: '160px', overflowY: 'auto', fontSize: '12px' }}>
          {formulaTab === 'fields' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {fields && fields.length > 0 ? (
                fields.map((f, idx) => {
                  const shortAlias = `F${idx + 1}`
                  return (
                    <div
                      key={f.id}
                      onClick={() => insertAtCursor(shortAlias)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#334155',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      title={`插入短代號 ${shortAlias} (${f.name})`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', color: '#18181B', background: '#F4F4F5', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          {shortAlias}
                        </span>
                        <span style={{ fontWeight: 500 }}>{f.name}</span>
                      </div>
                      <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '11px' }}>field_{f.id}</span>
                    </div>
                  )
                })
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>尚無可用欄位</div>
              )}
            </div>
          )}

          {formulaTab === 'functions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ position: 'sticky', top: 0, background: '#fff', paddingBottom: '6px', zIndex: 1 }}>
                <input
                  type="text"
                  value={functionSearch}
                  onChange={(e) => setFunctionSearch(e.target.value)}
                  placeholder="搜尋函數 (Search functions)..."
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '12px',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
              </div>
              {getSupportedFunctions(locale)
                .map(cat => ({
                  ...cat,
                  funcs: cat.funcs.map(f => ({ ...f, category: cat.category })).filter(fn =>
                    !functionSearch.trim() ||
                    fn.name.toLowerCase().includes(functionSearch.toLowerCase()) ||
                    fn.doc.toLowerCase().includes(functionSearch.toLowerCase())
                  )
                }))
                .filter(cat => cat.funcs.length > 0)
                .map((cat, idx) => (
                <div key={idx}>
                  <div style={{ fontWeight: 600, color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>{cat.category}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                    {cat.funcs.map((fn, fIdx) => {
                      const isSelected = selectedHelpFunc?.name === fn.name
                      return (
                        <button
                          key={fIdx}
                          type="button"
                          title={fn.doc}
                          onClick={() => {
                            insertAtCursor(`${fn.name}()`, 1)
                            setSelectedHelpFunc(fn)
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#F4F4F5'
                            setActiveHoverFunc(fn)
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isSelected ? '#F4F4F5' : '#f8fafc'
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: isSelected ? '1px solid #3F6212' : '1px solid #cbd5e1',
                            background: isSelected ? '#F4F4F5' : '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            color: isSelected ? '#2d470d' : '#3F6212',
                            fontWeight: isSelected ? 700 : 500
                          }}
                        >
                          {fn.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {formulaTab === 'operators' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px 0' }}>
              {['+', '-', '*', '/', '%', '^', '&', '=', '<>', '>', '<', '>=', '<=', '(', ')', ',', '""'].map((op, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => insertAtCursor(op)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#f1f5f9',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#0f172a'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Function Description & Help Panel (Baserow Style) */}
      {(() => {
        const displayFunc = activeHoverFunc || selectedHelpFunc
        return (
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '12px 14px',
            background: displayFunc ? '#f8fafc' : '#f1f5f9',
            transition: 'all 0.15s ease-in-out'
          }}>
            {displayFunc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: '#18181B',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {displayFunc.name}
                    </span>
                    {displayFunc.category && (
                      <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                        {displayFunc.category}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => insertAtCursor(`${displayFunc.name}()`, 1)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 10px',
                      background: '#18181B',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    + 插入 {displayFunc.name}()
                  </button>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase' }}>
                    語法說明 (Syntax)
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>
                    {displayFunc.doc}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase' }}>
                    使用範例 (Example)
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    color: '#18181B',
                    fontWeight: 600,
                    wordBreak: 'break-all'
                  }}>
                    <code>{displayFunc.snippet}</code>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px' }}>
                <Sparkles size={16} style={{ color: '#3F6212', flexShrink: 0 }} />
                <span>{t('fieldModal.formulaHoverInfo')}</span>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
