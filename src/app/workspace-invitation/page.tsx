'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Building2, UserCheck, ShieldCheck, ArrowRight, LogIn, UserPlus, CheckCircle2 } from 'lucide-react'

function WorkspaceInvitationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const workspaceIdStr =
    searchParams.get('workspaceId') ||
    searchParams.get('wsId') ||
    searchParams.get('id') ||
    searchParams.get('workspace_id') ||
    searchParams.get('ws_id')
  
  const [workspaceInfo, setWorkspaceInfo] = useState<{ id: number; name: string; inviterName: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form states if not logged in
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!workspaceIdStr) {
        setErrorMsg('無效的邀請連結（缺少工作區 ID）')
        setLoading(false)
        return
      }

      try {
        // 1. Fetch current user session
        const authRes = await fetch('/api/auth/me')
        if (authRes.ok) {
          const authData = await authRes.json()
          if (authData.user) {
            setCurrentUser(authData.user)
            if (authData.user.email) setEmail(authData.user.email)
          }
        }

        // 2. Fetch invitation info
        const infoRes = await fetch(`/api/workspaces/${workspaceIdStr}/invitation-info`)
        const infoData = await infoRes.json()

        if (infoRes.ok && infoData.id) {
          setWorkspaceInfo(infoData)
        } else {
          setErrorMsg(infoData.error || '找不到該工作區或連結已失效')
        }
      } catch (err: any) {
        setErrorMsg('載入邀請資訊失敗，請檢查網路連線')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceIdStr])

  const handleAcceptInvite = async () => {
    if (!workspaceIdStr) return
    setAccepting(true)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceIdStr}/accept-invite`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(data.message || '已成功加入工作區！')
        setTimeout(() => {
          router.push(`/?workspaceId=${workspaceIdStr}`)
        }, 1200)
      } else {
        setErrorMsg(data.error || '加入工作區失敗')
      }
    } catch {
      setErrorMsg('連線失敗，請稍後再試')
    } finally {
      setAccepting(false)
    }
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (!email.trim() || !password) {
      setAuthError('請填寫所有欄位')
      return
    }
    if (authMode === 'register' && !username.trim()) {
      setAuthError('請輸入使用者名稱')
      return
    }

    setAuthLoading(true)
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const payload = authMode === 'register' 
        ? { username: username.trim(), email: email.trim(), password }
        : { username: email.trim(), password } // login allows username or email

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok) {
        // Authenticated! Now accept invite
        const meRes = await fetch('/api/auth/me')
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData.user) setCurrentUser(meData.user)
        }
        await handleAcceptInvite()
      } else {
        setAuthError(data.error || '驗證失敗，請檢查輸入資料')
      }
    } catch {
      setAuthError('網路連線失敗，請稍後再試')
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>正在驗證工作區邀請連結...</p>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #e0e7ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 10px 20px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #e2e8f0', padding: '36px', boxSizing: 'border-box' }}>
        
        {/* Header Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(37,99,235,0.25)' }}>
            <Building2 size={32} color="#ffffff" />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '4px 12px', borderRadius: '12px' }}>
            工作區成員邀請 (Invitation)
          </span>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '12px 0 6px 0' }}>
            {workspaceInfo ? `加入「${workspaceInfo.name}」` : '工作區邀請'}
          </h1>
          {workspaceInfo && (
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              由 <strong style={{ color: '#334155' }}>{workspaceInfo.inviterName}</strong> 邀請您一同參與團隊資料庫協作
            </p>
          )}
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecdd3', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: '16px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '14px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        {/* IF USER IS LOGGED IN */}
        {currentUser ? (
          <div>
            <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck size={18} color="#2563eb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.username}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.email}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                已登入
              </span>
            </div>

            <button
              onClick={handleAcceptInvite}
              disabled={accepting || Boolean(successMsg)}
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor: accepting ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: accepting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              {accepting ? '正在處理加入...' : '接受邀請並進入工作區'}
              {!accepting && <ArrowRight size={18} />}
            </button>

            <button
              onClick={() => router.push('/')}
              style={{
                width: '100%',
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '12px'
              }}
            >
              返回主頁
            </button>
          </div>
        ) : (
          /* IF USER IS NOT LOGGED IN */
          <div>
            {/* Toggle Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: authMode === 'register' ? '#ffffff' : 'transparent',
                  color: authMode === 'register' ? '#0f172a' : '#64748b',
                  fontWeight: authMode === 'register' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: authMode === 'register' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                註冊新帳號加入
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: authMode === 'login' ? '#ffffff' : 'transparent',
                  color: authMode === 'login' ? '#0f172a' : '#64748b',
                  fontWeight: authMode === 'login' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: authMode === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                既有帳號登入
              </button>
            </div>

            {authError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecdd3', borderRadius: '8px', color: '#991b1b', fontSize: '12px', marginBottom: '16px' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    使用者名稱 (Username)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="輸入您的暱稱或姓名"
                    required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  {authMode === 'register' ? '電子郵件 (Email)' : '帳號或電子郵件 (Username or Email)'}
                </label>
                <input
                  type={authMode === 'register' ? 'email' : 'text'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={authMode === 'register' ? 'name@company.com' : '輸入帳號或 Email'}
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  密碼 (Password)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位密碼"
                  required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: authLoading ? '#93c5fd' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: authLoading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                }}
              >
                {authLoading ? '正在驗證並加入...' : (authMode === 'register' ? '完成註冊並加入工作區' : '登入並加入工作區')}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

export default function WorkspaceInvitationPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: '#64748b' }}>載入頁面中...</p>
      </div>
    }>
      <WorkspaceInvitationContent />
    </Suspense>
  )
}
