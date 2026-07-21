'use client'

import React, { useState, useEffect } from 'react'
import { X, Search, Plus, UserPlus, Shield, Trash2, Mail, Users, ChevronDown, Check, MoreVertical } from 'lucide-react'
import type { Workspace } from '@/modules/database/types'

export interface WorkspaceMember {
  id: number
  userId: number
  name: string
  email: string
  role: string // 'admin' | 'member' | 'viewer'
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
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting] = useState(false)

  // Modal for Creating Team
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Role Edit Menu dropdown state
  const [activeRoleDropdown, setActiveRoleDropdown] = useState<number | null>(null)
  const [activeActionMenu, setActiveActionMenu] = useState<number | null>(null)

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

  if (!show || !workspace) return null

  // Filter members by search query
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Send invitation handler
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || inviting) return
    setInviting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      })
      const data = await res.json()
      if (res.ok) {
        onToast(data.message || '邀請已發送！', 'success')
        setInviteEmail('')
        setShowInviteModal(false)
        await fetchMembersData()
      } else {
        onToast(data.error || '邀請發送失敗', 'error')
      }
    } catch {
      onToast('發送失敗，請稍後再試', 'error')
    } finally {
      setInviting(false)
    }
  }

  // Update member role
  const handleUpdateRole = async (userId: number, newRole: string) => {
    setActiveRoleDropdown(null)
    setActiveActionMenu(null)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })
      if (res.ok) {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m))
        onToast('成員角色已更新', 'success')
      } else {
        onToast('更新角色失敗', 'error')
      }
    } catch {
      onToast('更新角色失敗', 'error')
    }
  }

  // Remove member from workspace
  const handleRemoveMember = async (userId: number, memberName: string) => {
    setActiveActionMenu(null)
    if (!confirm(`確定要將「${memberName}」從工作區移除？`)) return
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members?userId=${userId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.userId !== userId))
        onToast(`已將 ${memberName} 從工作區移除`, 'success')
      } else {
        onToast('移除成員失敗', 'error')
      }
    } catch {
      onToast('移除成員失敗', 'error')
    }
  }

  // Revoke pending invitation
  const handleRevokeInvite = async (inviteId: number, email: string) => {
    if (!confirm(`確定要撤銷對 ${email} 的邀請？`)) return
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members?inviteId=${inviteId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setInvites(prev => prev.filter(i => i.id !== inviteId))
        onToast('邀請已撤銷', 'success')
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
        onToast(`團隊「${teamName}」建立成功`, 'success')
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)' }}>
      <div style={{ width: '92vw', maxWidth: '1080px', height: '84vh', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        
        {/* Header Tabs */}
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

        {/* Content Section */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              {/* Title & Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
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
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
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
                      filteredMembers.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Name + Avatar */}
                          <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <span>{m.name}</span>
                            </div>
                          </td>

                          {/* Email */}
                          <td style={{ padding: '16px 20px', color: '#475569' }}>{m.email}</td>

                          {/* Highest Role */}
                          <td style={{ padding: '16px 20px', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: m.role === 'admin' ? '#0f172a' : '#475569' }}>
                                {m.role === 'admin' ? 'Admin' : m.role === 'viewer' ? 'Viewer' : 'Member'}
                              </span>
                              {m.role === 'admin' && (
                                <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 600 }}>
                                  Billable
                                </span>
                              )}
                              <button
                                onClick={() => setActiveRoleDropdown(activeRoleDropdown === m.id ? null : m.id)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>

                            {/* Role Dropdown Menu */}
                            {activeRoleDropdown === m.id && (
                              <div style={{ position: 'absolute', top: '100%', left: '20px', zIndex: 10, width: '160px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', padding: '4px 0' }}>
                                <button
                                  onClick={() => handleUpdateRole(m.userId, 'admin')}
                                  style={{ width: '100%', padding: '8px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                  <span>Admin</span>
                                  {m.role === 'admin' && <Check size={14} color="#2563eb" />}
                                </button>
                                <button
                                  onClick={() => handleUpdateRole(m.userId, 'member')}
                                  style={{ width: '100%', padding: '8px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                  <span>Member</span>
                                  {m.role === 'member' && <Check size={14} color="#2563eb" />}
                                </button>
                                <button
                                  onClick={() => handleUpdateRole(m.userId, 'viewer')}
                                  style={{ width: '100%', padding: '8px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                  <span>Viewer</span>
                                  {m.role === 'viewer' && <Check size={14} color="#2563eb" />}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 2FA Badge */}
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: m.twoFactor ? '#dcfce7' : '#f1f5f9', color: m.twoFactor ? '#166534' : '#64748b' }}>
                              {m.twoFactor ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>

                          {/* Actions Context Menu */}
                          <td style={{ padding: '16px 20px', position: 'relative' }}>
                            <button
                              onClick={() => setActiveActionMenu(activeActionMenu === m.id ? null : m.id)}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeActionMenu === m.id && (
                              <div style={{ position: 'absolute', right: '20px', top: '100%', zIndex: 10, width: '180px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', padding: '4px 0' }}>
                                <button
                                  onClick={() => setActiveRoleDropdown(m.id)}
                                  style={{ width: '100%', padding: '8px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                  <Shield size={14} /> Edit role
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(m.userId, m.name)}
                                  style={{ width: '100%', padding: '8px 14px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                  <Trash2 size={14} /> Remove member
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
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
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Pending Invitations ({invites.length})
                </h2>
                <button
                  onClick={() => setShowInviteModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <UserPlus size={16} /> Invite member
                </button>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                      <th style={{ padding: '14px 20px' }}>Email</th>
                      <th style={{ padding: '14px 20px' }}>Role</th>
                      <th style={{ padding: '14px 20px' }}>Sent Date</th>
                      <th style={{ padding: '14px 20px', width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No pending invitations</td>
                      </tr>
                    ) : (
                      invites.map((inv) => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>{inv.email}</td>
                          <td style={{ padding: '16px 20px', color: '#475569', textTransform: 'capitalize' }}>{inv.role}</td>
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
                      ))
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
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
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
                    No teams created yet. Click "Create team" to group members.
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
                        {t.description || 'No description provided.'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Workspace Members Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div style={{ width: '460px', backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Invite workspace members
              </h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Invite by email</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', backgroundColor: '#f8fafc', outline: 'none' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={inviting}
                  style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
                >
                  {inviting ? 'Sending...' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div style={{ width: '440px', backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
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
