'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Search, UserPlus, Shield, Trash2, MoreVertical, Copy, Plus, Check, ChevronDown, Lock } from 'lucide-react'
import type { Workspace, User } from '@/modules/database/types'

interface WorkspaceMember {
  id: number
  userId: number
  name: string
  email: string
  role: string
  joinedAt: string
  twoFactor?: boolean
}

interface WorkspaceInvite {
  id: number
  email: string
  role: string
  createdAt: string
}

interface WorkspaceTeam {
  id: number
  name: string
  description?: string
  memberCount: number
}

interface MembersModalProps {
  show?: boolean
  workspace: Workspace | null
  currentUser?: User | null
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onUpdateWorkspaceMemberCount?: (count: number) => void
}

const WORKSPACE_ROLES = [
  {
    uid: 'admin',
    name: 'Admin (建立者 / 系統管理員)',
    description: '可完整配置工作區、建立與修改資料庫、資料表、欄位，並管理成員與權限設定。',
    badgeColor: '#2563eb'
  },
  {
    uid: 'editor',
    name: 'Editor (編輯者)',
    description: '可建立與修改資料庫、資料表、欄位、檢視表及資料列，但無法管理工作區成員。',
    badgeColor: '#059669'
  },
  {
    uid: 'commenter',
    name: 'Commenter (評論者)',
    description: '可檢視所有資料庫內容並新增備註或評論，但無法修改欄位結構或編輯資料列。',
    badgeColor: '#d97706'
  },
  {
    uid: 'viewer',
    name: 'Viewer (僅檢視者)',
    description: '僅可瀏覽與搜尋資料庫與檢視表內容，無法進行任何編輯、刪除或評論動作。',
    badgeColor: '#475569'
  }
]

export default function MembersModal({ workspace, currentUser, onClose, onToast, onUpdateWorkspaceMemberCount }: MembersModalProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'teams'>('members')
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [teams, setTeams] = useState<WorkspaceTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [showInviteRoleDropdown, setShowInviteRoleDropdown] = useState(false)
  const [inviteEmailError, setInviteEmailError] = useState('')
  const [inviting, setInviting] = useState(false)

  // Team Modal State
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Member Role Dropdown Context State
  const [activeRoleContextMember, setActiveRoleContextMember] = useState<WorkspaceMember | null>(null)
  const [activeRoleContextPos, setActiveRoleContextPos] = useState<{ top: number; left: number } | null>(null)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  // Action Menu Dropdown State
  const [activeActionMenuMemberId, setActiveActionMenuMemberId] = useState<number | null>(null)

  useEffect(() => {
    if (!workspace) return
    fetchMembersData()
  }, [workspace])

  // Close floating dropdowns when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setActiveRoleContextMember(null)
      }
    }
    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [])

  const fetchMembersData = async () => {
    if (!workspace) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`)
      if (res.ok) {
        const data = await res.json()
        const fetchedMembers = data.members || []
        setMembers(fetchedMembers)
        setInvites(data.invites || [])
        setTeams(data.teams || [])
        if (onUpdateWorkspaceMemberCount && fetchedMembers.length > 0) {
          onUpdateWorkspaceMemberCount(fetchedMembers.length)
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspace members:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!workspace) return null

  // Filter members by search query
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Send Email Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || inviting) return

    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteEmailError('請輸入有效的 Email 電子郵件地址')
      return
    }

    setInviting(true)
    setInviteEmailError('')

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', email: inviteEmail.trim(), role: inviteRole })
      })

      const data = await res.json()

      if (res.ok) {
        onToast(`已成功傳送邀請至 ${inviteEmail}`, 'success')
        setInviteEmail('')
        setShowInviteModal(false)
        await fetchMembersData()
      } else {
        setInviteEmailError(data.error || '傳送邀請失敗')
      }
    } catch {
      setInviteEmailError('網路連線失敗，請稍後再試')
    } finally {
      setInviting(false)
    }
  }

  // Copy Workspace Invite Link
  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/workspace-invitation?wsId=${workspace.id}`
    navigator.clipboard.writeText(inviteUrl)
    onToast('已複製工作區邀請連結至剪貼簿！', 'success')
  }

  // Update Member Role
  const handleUpdateRole = async (targetUserId: number, newRole: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, role: newRole })
      })

      if (res.ok) {
        setMembers(prev => prev.map(m => m.userId === targetUserId ? { ...m, role: newRole } : m))
        onToast('已更新成員角色權限', 'success')
        setActiveRoleContextMember(null)
      } else {
        onToast('變更權限失敗', 'error')
      }
    } catch {
      onToast('變更權限失敗', 'error')
    }
  }

  // Remove member from workspace
  const handleRemoveMember = async (userId: number, memberName: string) => {
    if (!confirm(`確定要將「${memberName}」從工作區中移除？此動作無法復原。`)) return
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members?userId=${userId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.userId !== userId))
        onToast(`已成功將 ${memberName} 從工作區移除`, 'success')
      } else {
        onToast('移除成員失敗', 'error')
      }
    } catch {
      onToast('移除成員失敗', 'error')
    }
  }

  // Revoke pending invitation
  const handleRevokeInvite = async (inviteId: number, email: string) => {
    if (!confirm(`確定要撤銷對 ${email} 的工作區邀請？`)) return
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members?inviteId=${inviteId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setInvites(prev => prev.filter(i => i.id !== inviteId))
        onToast('邀請已成功撤銷', 'success')
      }
    } catch {
      onToast('撤銷邀請失敗', 'error')
    }
  }

  // Create team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim() || creatingTeam) return
    setCreatingTeam(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_team', teamName, teamDescription: teamDesc })
      })
      if (res.ok) {
        onToast(`團隊「${teamName}」已成功建立`, 'success')
        setTeamName('')
        setTeamDesc('')
        setShowTeamModal(false)
        await fetchMembersData()
      }
    } catch {
      onToast('建立團隊失敗', 'error')
    } finally {
      setCreatingTeam(false)
    }
  }

  const selectedInviteRoleObj = WORKSPACE_ROLES.find(r => r.uid === inviteRole) || WORKSPACE_ROLES[0]

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', padding: '12px' }}
    >
      <style>{`
        .members-modal-card {
          width: 95vw;
          max-width: 1120px;
          height: 88vh;
          max-height: 800px;
          background-color: #ffffff;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .members-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f8fafc;
        }
        .members-modal-tabs {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .members-modal-tabs::-webkit-scrollbar {
          display: none;
        }
        .members-modal-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          gap: 16px;
        }
        .members-modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.3;
        }
        .members-modal-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .members-modal-search-wrapper {
          position: relative;
          width: 220px;
        }
        .members-modal-invite-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          background-color: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(37,99,235,0.2);
        }

        @media (max-width: 640px) {
          .members-modal-header {
            padding: 12px 14px;
          }
          .members-modal-tabs {
            gap: 12px;
          }
          .members-modal-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .members-modal-actions {
            flex-direction: column;
            width: 100%;
            gap: 8px;
          }
          .members-modal-search-wrapper {
            width: 100% !important;
          }
          .members-modal-invite-btn {
            width: 100% !important;
            justify-content: center;
          }
        }
      `}</style>

      <div className="members-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Header Tabs */}
        <div className="members-modal-header">
          <div className="members-modal-tabs">
            <button
              onClick={() => setActiveTab('members')}
              style={{
                paddingBottom: '8px',
                fontSize: '14px',
                fontWeight: activeTab === 'members' ? 700 : 500,
                color: activeTab === 'members' ? '#2563eb' : '#64748b',
                borderBottom: activeTab === 'members' ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Members ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              style={{
                paddingBottom: '8px',
                fontSize: '14px',
                fontWeight: activeTab === 'invites' ? 700 : 500,
                color: activeTab === 'invites' ? '#2563eb' : '#64748b',
                borderBottom: activeTab === 'invites' ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Invites ({invites.length})
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              style={{
                paddingBottom: '8px',
                fontSize: '14px',
                fontWeight: activeTab === 'teams' ? 700 : 500,
                color: activeTab === 'teams' ? '#2563eb' : '#64748b',
                borderBottom: activeTab === 'teams' ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Teams ({teams.length})
            </button>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '8px', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', position: 'relative' }}>
          
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              {/* Responsive Toolbar */}
              <div className="members-modal-toolbar">
                <h2 className="members-modal-title">
                  {members.length} Members in {workspace.name}
                </h2>

                <div className="members-modal-actions">
                  {/* Search Bar */}
                  <div className="members-modal-search-wrapper">
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ padding: '8px 12px 8px 36px', width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Invite Member Button */}
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="members-modal-invite-btn"
                  >
                    <UserPlus size={16} /> Invite member
                  </button>
                </div>
              </div>

              {/* Members Table with Horizontal Scroll Container */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', backgroundColor: '#ffffff' }}>
                <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>Name</th>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>Email</th>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>Highest Role 🛈</th>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>2FA</th>
                      <th style={{ padding: '14px 18px', width: '60px', whiteSpace: 'nowrap' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading workspace members...</td>
                      </tr>
                    ) : filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No members found</td>
                      </tr>
                    ) : (
                      filteredMembers.map((m, index) => {
                        const isCreator = index === 0 || m.role === 'owner'
                        const currentRoleObj = isCreator
                          ? { uid: 'admin', name: 'Admin (建立者)', description: '工作區建立者，具備最高權限且不可變更', badgeColor: '#2563eb' }
                          : (WORKSPACE_ROLES.find(r => r.uid === m.role) || { uid: m.role, name: m.role.toUpperCase(), description: '', badgeColor: '#2563eb' })

                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {/* Name */}
                            <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: isCreator ? '#1d4ed8' : '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                  <span>{m.name}</span>
                                  {isCreator && (
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap', display: 'inline-block', flexShrink: 0 }}>
                                      建立者
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Email */}
                            <td style={{ padding: '14px 18px', color: '#475569', whiteSpace: 'nowrap' }}>{m.email}</td>

                            {/* Highest Role with Floating Role Context Trigger */}
                            <td style={{ padding: '14px 18px', position: 'relative', whiteSpace: 'nowrap' }}>
                              <div
                                onClick={(e) => {
                                  if (isCreator) {
                                    onToast('工作區建立者之角色權限固定為「系統管理員」，不可更換。', 'info')
                                    return
                                  }
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setActiveRoleContextPos({ top: rect.bottom + window.scrollY, left: Math.min(rect.left + window.scrollX, window.innerWidth - 350) })
                                  setActiveRoleContextMember(activeRoleContextMember?.id === m.id ? null : m)
                                }}
                                title={isCreator ? '工作區建立者之權限固定為系統管理員' : '點擊變更角色權限'}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  cursor: isCreator ? 'not-allowed' : 'pointer',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  backgroundColor: isCreator ? '#eff6ff' : '#f8fafc',
                                  border: isCreator ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                  opacity: isCreator ? 0.9 : 1,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <span style={{ fontWeight: 600, color: isCreator ? '#1d4ed8' : '#0f172a', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                  {currentRoleObj.name}
                                </span>
                                {isCreator ? <Lock size={13} color="#2563eb" /> : <ChevronDown size={14} color="#64748b" />}
                              </div>
                            </td>

                            {/* 2FA */}
                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: m.twoFactor ? '#dcfce7' : '#f1f5f9', color: m.twoFactor ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>
                                {m.twoFactor ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>

                            {/* Actions Dropdown */}
                            <td style={{ padding: '14px 18px', position: 'relative', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => setActiveActionMenuMemberId(activeActionMenuMemberId === m.id ? null : m.id)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeActionMenuMemberId === m.id && (
                                <div style={{ position: 'absolute', right: '20px', top: '100%', zIndex: 100, width: '190px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', padding: '6px 0' }}>
                                  {!isCreator && (
                                    <button
                                      onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        setActiveRoleContextPos({ top: rect.bottom + window.scrollY, left: Math.min(rect.left + window.scrollX, window.innerWidth - 350) })
                                        setActiveRoleContextMember(m)
                                        setActiveActionMenuMemberId(null)
                                      }}
                                      style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <Shield size={14} color="#3b82f6" /> 編輯角色權限
                                    </button>
                                  )}
                                  {!isCreator ? (
                                    <button
                                      onClick={() => handleRemoveMember(m.userId, m.name)}
                                      style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <Trash2 size={14} color="#ef4444" /> 從工作區移除成員
                                    </button>
                                  ) : (
                                    <div style={{ padding: '9px 14px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                      建立者不可移除
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invites Tab */}
          {activeTab === 'invites' && (
            <div>
              <div className="members-modal-toolbar">
                <h2 className="members-modal-title">
                  Pending Invitations ({invites.length})
                </h2>
                <div className="members-modal-actions">
                  <button
                    onClick={handleCopyInviteLink}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <Copy size={15} /> 複製邀請連結
                  </button>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="members-modal-invite-btn"
                  >
                    <UserPlus size={16} /> Invite member
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', backgroundColor: '#ffffff' }}>
                <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>Email</th>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>Assigned Role</th>
                      <th style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>Sent Date</th>
                      <th style={{ padding: '14px 18px', width: '140px', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>目前無等待處理的邀請</td>
                      </tr>
                    ) : (
                      invites.map((inv) => {
                        const rObj = WORKSPACE_ROLES.find(r => r.uid === inv.role) || { name: inv.role.toUpperCase() }
                        return (
                          <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{inv.email}</td>
                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: '#334155' }}>{rObj.name}</span>
                            </td>
                            <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => handleRevokeInvite(inv.id, inv.email)}
                                style={{ padding: '6px 12px', backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div>
              <div className="members-modal-toolbar">
                <h2 className="members-modal-title">
                  Workspace Teams ({teams.length})
                </h2>
                <button
                  onClick={() => setShowTeamModal(true)}
                  className="members-modal-invite-btn"
                >
                  <Plus size={16} /> Create team
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {teams.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                    尚未建立任何團隊。點擊「Create team」整合團隊成員。
                  </div>
                ) : (
                  teams.map((t) => (
                    <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{t.name}</h3>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {t.memberCount} members
                        </span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0', minHeight: '36px' }}>
                        {t.description || '無詳細描述'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clean EditRoleContext Floating Popup Window */}
      {activeRoleContextMember && (
        <div
          ref={roleMenuRef}
          style={{ position: 'fixed', top: activeRoleContextPos ? Math.min(activeRoleContextPos.top, window.innerHeight - 340) : '30%', left: activeRoleContextPos ? Math.max(16, Math.min(activeRoleContextPos.left, window.innerWidth - 350)) : '5%', zIndex: 1200, width: 'calc(100vw - 32px)', maxWidth: '340px', backgroundColor: '#ffffff', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.22)', border: '1px solid #e2e8f0', padding: '14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              變更角色權限 (Role)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
            {WORKSPACE_ROLES.map((role) => {
              const isSelected = activeRoleContextMember.role === role.uid
              return (
                <div
                  key={role.uid}
                  onClick={() => handleUpdateRole(activeRoleContextMember.userId, role.uid)}
                  style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: isSelected ? '1px solid #93c5fd' : '1px solid transparent', backgroundColor: isSelected ? '#eff6ff' : 'transparent', transition: 'all 0.15s ease', display: 'flex', flexDirection: 'column', gap: '4px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#1e40af' : '#0f172a' }}>
                      {role.name}
                    </span>
                    {isSelected && <Check size={16} color="#2563eb" />}
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                    {role.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invite Workspace Members Modal */}
      {showInviteModal && (
        <div onClick={() => setShowInviteModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Invite workspace members
              </h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Invite by email</label>
                <input
                  type="email"
                  placeholder="Enter email address..."
                  value={inviteEmail}
                  onChange={e => {
                    setInviteEmail(e.target.value)
                    setInviteEmailError('')
                  }}
                  style={{ padding: '10px 14px', border: inviteEmailError ? '1px solid #ef4444' : '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
                />
                {inviteEmailError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>{inviteEmailError}</span>
                )}
              </div>

              {/* Custom Role Selector Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Select role permission</label>
                </div>

                <div
                  onClick={() => setShowInviteRoleDropdown(!showInviteRoleDropdown)}
                  style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{selectedInviteRoleObj.name}</span>
                  <ChevronDown size={16} color="#64748b" />
                </div>

                {/* Floating Role Selection List */}
                {showInviteRoleDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 15px 35px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', padding: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    {WORKSPACE_ROLES.map(role => (
                      <div
                        key={role.uid}
                        onClick={() => {
                          setInviteRole(role.uid)
                          setShowInviteRoleDropdown(false)
                        }}
                        style={{ padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', backgroundColor: inviteRole === role.uid ? '#eff6ff' : 'transparent', display: 'flex', flexDirection: 'column', gap: '2px' }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '13px', color: inviteRole === role.uid ? '#2563eb' : '#0f172a' }}>{role.name}</span>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{role.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <Copy size={14} /> 複製邀請連結
                </button>

                <button
                  type="submit"
                  disabled={inviting}
                  style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)', whiteSpace: 'nowrap' }}
                >
                  {inviting ? 'Sending invite...' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showTeamModal && (
        <div onClick={() => setShowTeamModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.4)', padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Create new team</h3>
              <button onClick={() => setShowTeamModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Team name</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering, Marketing"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Description (optional)</label>
                <textarea
                  placeholder="Team description..."
                  value={teamDesc}
                  onChange={e => setTeamDesc(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', outline: 'none', minHeight: '70px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={creatingTeam}
                  style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {creatingTeam ? 'Creating...' : 'Create team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
