'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Search, Plus, UserPlus, Shield, Trash2, Mail, Users, ChevronDown, Check, MoreVertical, HelpCircle, ExternalLink, Copy, Lock } from 'lucide-react'
import type { Workspace } from '@/modules/database/types'

export interface WorkspaceMember {
  id: number
  userId: number
  name: string
  email: string
  role: string // 'admin' | 'builder' | 'editor' | 'commenter' | 'viewer' | 'no_role'
  twoFactor: boolean
  createdAt: string
}

export interface WorkspaceInvite {
  id: number
  email: string
  role: string
  createdAt: string
}

export interface WorkspaceTeam {
  id: number
  name: string
  description: string
  memberCount: number
  members: { id: number; name: string; email: string }[]
}

export interface BaserowRoleDefinition {
  uid: string
  name: string
  description: string
  isBillable: boolean
}

export const BASEROW_ROLES: BaserowRoleDefinition[] = [
  {
    uid: 'admin',
    name: 'Admin',
    description: '可以完整配置工作區、建立與修改資料庫、資料表、欄位，並管理成員與權限設定。',
    isBillable: true
  },
  {
    uid: 'builder',
    name: 'Builder',
    description: '可建立與修改資料庫、資料表、欄位、檢視表及資料列，但無法管理工作區成員。',
    isBillable: true
  },
  {
    uid: 'editor',
    name: 'Editor',
    description: '可新增、編輯與刪除資料列的數值，但無法修改資料表結構或欄位型態。',
    isBillable: true
  },
  {
    uid: 'commenter',
    name: 'Commenter',
    description: '可檢視資料表內容並在資料列留言討論，但無法修改資料內容或結構。',
    isBillable: true
  },
  {
    uid: 'viewer',
    name: 'Viewer',
    description: '唯讀權限。僅能瀏覽資料表、欄位與檢視表，無法進行任何修改或留言。',
    isBillable: false
  }
]

interface MembersModalProps {
  show: boolean
  onClose: () => void
  workspace: Workspace | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onUpdateWorkspaceMemberCount?: (count: number) => void
}

export default function MembersModal({
  show,
  onClose,
  workspace,
  onToast,
  onUpdateWorkspaceMemberCount
}: MembersModalProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'teams'>('members')
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [teams, setTeams] = useState<WorkspaceTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal for Inviting
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('admin')
  const [inviteEmailError, setInviteEmailError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [showInviteRoleDropdown, setShowInviteRoleDropdown] = useState(false)

  // Modal for Creating Team
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Role Edit Context Floating Popover State
  const [activeRoleContextMember, setActiveRoleContextMember] = useState<WorkspaceMember | null>(null)
  const [activeRoleContextPos, setActiveRoleContextPos] = useState<{ top: number; left: number } | null>(null)

  // Actions Dropdown Menu State
  const [activeActionMenuMemberId, setActiveActionMenuMemberId] = useState<number | null>(null)

  const roleMenuRef = useRef<HTMLDivElement>(null)

  const fetchMembersData = async () => {
    if (!workspace) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setInvites(data.invitations || [])
        setTeams(data.teams || [])
        if (onUpdateWorkspaceMemberCount) {
          onUpdateWorkspaceMemberCount((data.members || []).length)
        }
      }
    } catch (err) {
      console.error('Failed to load workspace members:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (show && workspace) {
      fetchMembersData()
    }
  }, [show, workspace?.id])

  // Close floating menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setActiveRoleContextMember(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!show || !workspace) return null

  // Filter members by search query
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Validate email format
  const validateEmail = (emailStr: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(emailStr)
  }

  // Send invitation handler
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteEmailError('')
    if (!inviteEmail.trim()) {
      setInviteEmailError('此欄位為必填')
      return
    }
    if (!validateEmail(inviteEmail.trim())) {
      setInviteEmailError('請輸入有效的電子郵件格式')
      return
    }
    if (inviting) return

    setInviting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      })
      const data = await res.json()
      if (res.ok) {
        onToast(data.message || '邀請已成功寄出！', 'success')
        setInviteEmail('')
        setShowInviteModal(false)
        await fetchMembersData()
      } else {
        setInviteEmailError(data.error || '邀請發送失敗')
        onToast(data.error || '邀請發送失敗', 'error')
      }
    } catch {
      onToast('發送失敗，請稍後再試', 'error')
    } finally {
      setInviting(false)
    }
  }

  // Copy invitation link helper
  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/workspace-invitation?workspaceId=${workspace.id}`
    navigator.clipboard.writeText(inviteUrl)
    onToast('已複製邀請連結至剪貼簿！', 'success')
  }

  // Update member role
  const handleUpdateRole = async (userId: number, newRole: string) => {
    setActiveRoleContextMember(null)
    setActiveActionMenuMemberId(null)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })
      if (res.ok) {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m))
        const roleObj = BASEROW_ROLES.find(r => r.uid === newRole)
        onToast(`成員權限已成功更新為「${roleObj?.name || newRole}」`, 'success')
      } else {
        onToast('更新角色權限失敗', 'error')
      }
    } catch {
      onToast('更新角色權限失敗', 'error')
    }
  }

  // Remove member from workspace
  const handleRemoveMember = async (userId: number, memberName: string) => {
    setActiveActionMenuMemberId(null)
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

  const selectedInviteRoleObj = BASEROW_ROLES.find(r => r.uid === inviteRole) || BASEROW_ROLES[0]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '92vw', maxWidth: '1120px', height: '86vh', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        
        {/* Top Header Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <button
              onClick={() => setActiveTab('members')}
              style={{ paddingBottom: '8px', fontSize: '15px', fontWeight: activeTab === 'members' ? 600 : 500, color: activeTab === 'members' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'members' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
            >
              Members ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              style={{ paddingBottom: '8px', fontSize: '15px', fontWeight: activeTab === 'invites' ? 600 : 500, color: activeTab === 'invites' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'invites' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
            >
              Invites ({invites.length})
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              style={{ paddingBottom: '8px', fontSize: '15px', fontWeight: activeTab === 'teams' ? 600 : 500, color: activeTab === 'teams' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'teams' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
            >
              Teams ({teams.length})
            </button>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px', position: 'relative' }}>
          
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {members.length} Members in {workspace.name}
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Search Bar */}
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ padding: '8px 12px 8px 36px', width: '220px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  {/* Invite Member Button */}
                  <button
                    onClick={() => setShowInviteModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' }}
                  >
                    <UserPlus size={16} /> Invite member
                  </button>
                </div>
              </div>

              {/* Members Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                      <th style={{ padding: '14px 20px' }}>Name</th>
                      <th style={{ padding: '14px 20px' }}>Email</th>
                      <th style={{ padding: '14px 20px' }}>Highest Role 🛈</th>
                      <th style={{ padding: '14px 20px' }}>2FA</th>
                      <th style={{ padding: '14px 20px', width: '60px' }}></th>
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
                      filteredMembers.map((m) => {
                        const currentRoleObj = BASEROW_ROLES.find(r => r.uid === m.role) || { uid: m.role, name: m.role.toUpperCase(), description: '', isBillable: true }

                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {/* Name */}
                            <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                <span>{m.name}</span>
                              </div>
                            </td>

                            {/* Email */}
                            <td style={{ padding: '16px 20px', color: '#475569' }}>{m.email}</td>

                            {/* Highest Role with Baserow Floating Role Context Trigger */}
                            <td style={{ padding: '16px 20px', position: 'relative' }}>
                              <div
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setActiveRoleContextPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX })
                                  setActiveRoleContextMember(activeRoleContextMember?.id === m.id ? null : m)
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                              >
                                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                                  {currentRoleObj.name}
                                </span>

                                {currentRoleObj.isBillable ? (
                                  <span style={{ padding: '1px 7px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 700 }}>
                                    Billable
                                  </span>
                                ) : (
                                  <span style={{ padding: '1px 7px', borderRadius: '4px', backgroundColor: '#fef9c3', color: '#854d0e', fontSize: '11px', fontWeight: 700 }}>
                                    Free
                                  </span>
                                )}

                                <ChevronDown size={14} color="#64748b" />
                              </div>
                            </td>

                            {/* 2FA */}
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: m.twoFactor ? '#dcfce7' : '#f1f5f9', color: m.twoFactor ? '#166534' : '#64748b' }}>
                                {m.twoFactor ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>

                            {/* Actions Dropdown */}
                            <td style={{ padding: '16px 20px', position: 'relative' }}>
                              <button
                                onClick={() => setActiveActionMenuMemberId(activeActionMenuMemberId === m.id ? null : m.id)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeActionMenuMemberId === m.id && (
                                <div style={{ position: 'absolute', right: '20px', top: '100%', zIndex: 100, width: '190px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', padding: '6px 0' }}>
                                  <button
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setActiveRoleContextPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX })
                                      setActiveRoleContextMember(m)
                                      setActiveActionMenuMemberId(null)
                                    }}
                                    style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <Shield size={14} color="#3b82f6" /> 編輯角色權限
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMember(m.userId, m.name)}
                                    style={{ width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <Trash2 size={14} color="#ef4444" /> 從工作區移除成員
                                  </button>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Pending Invitations ({invites.length})
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleCopyInviteLink}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Copy size={15} /> 複製邀請連結
                  </button>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <UserPlus size={16} /> Invite member
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                      <th style={{ padding: '14px 20px' }}>Email</th>
                      <th style={{ padding: '14px 20px' }}>Assigned Role</th>
                      <th style={{ padding: '14px 20px' }}>Sent Date</th>
                      <th style={{ padding: '14px 20px', width: '140px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>目前無等待處理的邀請</td>
                      </tr>
                    ) : (
                      invites.map((inv) => {
                        const rObj = BASEROW_ROLES.find(r => r.uid === inv.role) || { name: inv.role.toUpperCase(), isBillable: true }
                        return (
                          <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>{inv.email}</td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ fontWeight: 600, color: '#334155' }}>{rObj.name}</span>
                            </td>
                            <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '13px' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '16px 20px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Workspace Teams ({teams.length})
                </h2>
                <button
                  onClick={() => setShowTeamModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={16} /> Create team
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {teams.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                    尚未建立任何團隊。點擊「Create team」整合團隊成員。
                  </div>
                ) : (
                  teams.map((t) => (
                    <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{t.name}</h3>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '12px', fontWeight: 600 }}>
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

      {/* Baserow EditRoleContext Floating Popup Window */}
      {activeRoleContextMember && (
        <div
          ref={roleMenuRef}
          style={{ position: 'fixed', top: activeRoleContextPos ? Math.min(activeRoleContextPos.top, window.innerHeight - 340) : '30%', left: activeRoleContextPos ? Math.min(activeRoleContextPos.left, window.innerWidth - 360) : '40%', zIndex: 1200, width: '340px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.22)', border: '1px solid #e2e8f0', padding: '14px', animation: 'fadeIn 0.15s ease-out' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              變更角色權限 (Role)
            </span>
            <a href="https://baserow.io/user-docs/subscriptions-overview#who-is-considered-a-user-for-billing-purposes" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <HelpCircle size={12} /> 權限說明 <ExternalLink size={10} />
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
            {BASEROW_ROLES.map((role) => {
              const isSelected = activeRoleContextMember.role === role.uid
              return (
                <div
                  key={role.uid}
                  onClick={() => handleUpdateRole(activeRoleContextMember.userId, role.uid)}
                  style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: isSelected ? '1px solid #93c5fd' : '1px solid transparent', backgroundColor: isSelected ? '#eff6ff' : 'transparent', transition: 'all 0.15s ease', display: 'flex', flexDirection: 'column', gap: '4px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#1e40af' : '#0f172a' }}>
                        {role.name}
                      </span>
                      {role.isBillable ? (
                        <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '10px', fontWeight: 700 }}>
                          Billable
                        </span>
                      ) : (
                        <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef9c3', color: '#854d0e', fontSize: '10px', fontWeight: 700 }}>
                          Free
                        </span>
                      )}
                    </div>
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

      {/* Baserow Invite Workspace Members Modal (Floating Centered Dialog) */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: '520px', backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', animation: 'modalSlideIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
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
                  style={{ padding: '10px 14px', border: inviteEmailError ? '1px solid #ef4444' : '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                />
                {inviteEmailError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>{inviteEmailError}</span>
                )}
              </div>

              {/* Baserow Custom Role Selector Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Select role permission</label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>🛈 各角色權限可隨時於成員列表中調整</span>
                </div>

                <div
                  onClick={() => setShowInviteRoleDropdown(!showInviteRoleDropdown)}
                  style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{selectedInviteRoleObj.name}</span>
                    {selectedInviteRoleObj.isBillable ? (
                      <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 700 }}>Billable</span>
                    ) : (
                      <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef9c3', color: '#854d0e', fontSize: '11px', fontWeight: 700 }}>Free</span>
                    )}
                  </div>
                  <ChevronDown size={16} color="#64748b" />
                </div>

                {/* Floating Role Selection List */}
                {showInviteRoleDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 15px 35px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', padding: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    {BASEROW_ROLES.map(role => (
                      <div
                        key={role.uid}
                        onClick={() => {
                          setInviteRole(role.uid)
                          setShowInviteRoleDropdown(false)
                        }}
                        style={{ padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', backgroundColor: inviteRole === role.uid ? '#eff6ff' : 'transparent', display: 'flex', flexDirection: 'column', gap: '2px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: inviteRole === role.uid ? '#2563eb' : '#0f172a' }}>{role.name}</span>
                          {role.isBillable ? (
                            <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '10px', fontWeight: 700 }}>Billable</span>
                          ) : (
                            <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef9c3', color: '#854d0e', fontSize: '10px', fontWeight: 700 }}>Free</span>
                          )}
                        </div>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{role.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Copy size={14} /> 複製邀請連結
                </button>

                <button
                  type="submit"
                  disabled={inviting}
                  style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.4)' }}>
          <div style={{ width: '460px', backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
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
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Description (optional)</label>
                <textarea
                  placeholder="Team description..."
                  value={teamDesc}
                  onChange={e => setTeamDesc(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', minHeight: '70px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={creatingTeam}
                  style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
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
