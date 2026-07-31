import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, UploadCloud, Link as LinkIcon, Key, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface AirtableImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: any) => void
  activeWorkspaceId: number | null
}

export function AirtableImportModal({ isOpen, onClose, onSuccess, activeWorkspaceId }: AirtableImportModalProps) {
  const [tab, setTab] = useState<'url' | 'token' | 'json'>('url')
  const [shareUrl, setShareUrl] = useState('')
  const [token, setToken] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [resultStats, setResultStats] = useState<{ tableCount: number; rowCount: number } | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  const mousedownOnBackdropRef = useRef<boolean>(false)

  // Reset modal state when opened
  React.useEffect(() => {
    if (isOpen) {
      setShareUrl('')
      setToken('')
      setJsonText('')
      setError(null)
      setResultStats(null)
      setLoading(false)
      setProgress(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleImport = async () => {
    setError(null)
    setLoading(true)
    setProgress(20)

    try {
      if (!activeWorkspaceId) {
        throw new Error('未選擇作用中的工作區，請先選擇或建立工作區。')
      }

      let bodyData: any = { workspaceId: activeWorkspaceId }

      if (tab === 'url') {
        if (!shareUrl.trim()) throw new Error('請輸入 Airtable 共享網址')
        bodyData = { ...bodyData, shareUrl: shareUrl.trim() }
      } else if (tab === 'token') {
        if (!token.trim()) throw new Error('請輸入 Personal Access Token (PAT)')
        if (!shareUrl.trim()) throw new Error('請輸入 Base ID 或網址')
        bodyData = { ...bodyData, token: token.trim(), shareUrl: shareUrl.trim() }
      } else if (tab === 'json') {
        if (!jsonText.trim()) throw new Error('請貼上或選擇 JSON 結構內容')
        try {
          const parsed = JSON.parse(jsonText)
          bodyData = { ...bodyData, rawPayload: parsed }
        } catch {
          throw new Error('無效 JSON 格式')
        }
      }

      setProgress(50)

      const res = await fetch('/api/database/import/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '匯入失敗')
      }

      setProgress(100)
      setResultStats(data.stats)
      if (onSuccess) onSuccess(data)
    } catch (err: any) {
      setError(err.message || '匯入過程發生未知錯誤')
    } finally {
      setLoading(false)
    }
  }

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mousedownOnBackdropRef.current = (e.target === overlayRef.current)
  }

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && mousedownOnBackdropRef.current) {
      onClose()
    }
    mousedownOnBackdropRef.current = false
  }

  const modalContent = (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#F4F4F5',
                color: '#18181B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                從 Airtable 匯入
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                匯入 Airtable 基礎架構、欄位型別與資料集
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '4px 16px 0 16px', gap: '8px' }}>
          {[
            { id: 'url', label: '共享網址', icon: LinkIcon },
            { id: 'token', label: 'API Key / Token', icon: Key },
            { id: 'json', label: 'JSON 結構上傳', icon: FileText },
          ].map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id as any); setError(null); setResultStats(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  color: active ? '#3F6212' : '#64748b',
                  border: 'none',
                  borderBottom: active ? '2px solid #3F6212' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ lineHeight: '1.5' }}>{error}</span>
            </div>
          )}

          {resultStats ? (
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={36} color="#16a34a" />
              <h4 style={{ margin: 0, fontSize: '15px', color: '#15803d', fontWeight: 600 }}>
                Airtable 資料匯入成功！
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
                成功建立 {resultStats.tableCount} 個表格與 {resultStats.rowCount} 筆紀錄。
              </p>
            </div>
          ) : (
            <>
              {tab === 'url' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#F4F4F5',
                      border: '1px solid #E4E4E7',
                      color: '#1e40af',
                      fontSize: '12px',
                      lineHeight: '1.5',
                    }}
                  >
                    💡 此方式不需要 API Key，但需要該 Base 已設定為公開共享（Share base → Create a shared link）。
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                      Airtable Shared Base URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://airtable.com/appXXX/shrXXX 或 https://airtable.com/shrXXX"
                      value={shareUrl}
                      onChange={(e) => setShareUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                      貼上 Airtable 的「Share base」或「Share view」公開連結
                    </span>
                  </div>
                </div>
              )}

              {tab === 'token' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                      Personal Access Token (PAT)
                    </label>
                    <input
                      type="password"
                      placeholder="pat..."
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                      Base ID (例如 appXXXXXXXXXXXXXX)
                    </label>
                    <input
                      type="text"
                      placeholder="app..."
                      value={shareUrl}
                      onChange={(e) => setShareUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              {tab === 'json' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                    Airtable JSON 結構內容
                  </label>
                  <textarea
                    rows={5}
                    placeholder='{"tables": [{ "name": "Table 1", "fields": [...], "records": [...] }]}'
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}

              {loading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                    <span>正在解析 Airtable 結構與紀錄...</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        backgroundColor: '#18181B',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {resultStats ? '關閉' : '取消'}
          </button>
          {!resultStats && (
            <button
              onClick={handleImport}
              disabled={loading}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: loading ? '#93c5fd' : '#3F6212',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? '匯入中...' : '開始匯入'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
}
