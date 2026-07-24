'use client'

import React, { useState } from 'react'
import type { User, Workspace, Database } from '@/modules/database/types'
import { 
  Database as DatabaseIcon, Table as TableIcon, Users, Plus, 
  Sparkles, FolderPlus, Layers, ChevronRight, Search,
  ArrowUpRight, ShieldCheck, Activity, Filter
} from 'lucide-react'

interface WorkspaceDashboardProps {
  currentUser: User
  activeWorkspace: Workspace | null
  workspaces: Workspace[]
  onSelectTable: (tableId: number) => void
  onShowMembersModal?: () => void
  onShowDatabaseModal?: (wsId: number) => void
  onShowCreateTableModal?: (dbId: number) => void
}

export default function WorkspaceDashboard({
  currentUser,
  activeWorkspace,
  workspaces,
  onSelectTable,
  onShowMembersModal,
  onShowDatabaseModal,
  onShowCreateTableModal
}: WorkspaceDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate statistics
  const databases: Database[] = activeWorkspace?.databases || []
  const totalTablesCount = databases.reduce((acc, db) => acc + (db.tables?.length || 0), 0)
  const memberCount = activeWorkspace?.members?.length || 1

  // Filter databases & tables based on search query
  const filteredDatabases = databases.map(db => {
    if (!searchQuery.trim()) return db
    const q = searchQuery.toLowerCase()
    const dbMatch = db.name.toLowerCase().includes(q)
    const matchingTables = (db.tables || []).filter(t => t.name.toLowerCase().includes(q))
    if (dbMatch) return db
    if (matchingTables.length > 0) {
      return { ...db, tables: matchingTables }
    }
    return null
  }).filter(Boolean) as Database[]

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '36px 48px',
      backgroundColor: '#f8fafc',
      fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      color: '#0f172a'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Hero Banner Section */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
          borderRadius: '24px',
          padding: '40px 48px',
          color: '#ffffff',
          boxShadow: '0 20px 45px -15px rgba(37,99,235,0.25), 0 4px 12px rgba(15,23,42,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Ambient Glow Shapes */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(37,99,235,0) 70%)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-40%',
            left: '20%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0) 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '5px 14px',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <Sparkles size={14} color="#f59e0b" /> 歡迎回來，{currentUser.username}！
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                background: 'rgba(59,130,246,0.3)',
                padding: '5px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(147,197,253,0.3)'
              }}>
                <ShieldCheck size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
                {currentUser.role === 'admin' ? '系統最高管理者' : '工作區成員'}
              </span>
            </div>

            <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 10px 0', lineHeight: 1.25, letterSpacing: '-0.5px' }}>
              {activeWorkspace?.name || '預設工作區'}
            </h1>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6, fontWeight: 400 }}>
              歡迎使用雲端 No-Code 資料庫管理中心。您可以隨時檢視數據統計、開啟資料表或迅速新增資料庫結構。
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 2, flexShrink: 0 }}>
            {activeWorkspace && onShowDatabaseModal && (
              <button
                onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                style={{
                  padding: '14px 24px',
                  borderRadius: '14px',
                  backgroundColor: '#ffffff',
                  color: '#1e40af',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 25px rgba(0,0,0,0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)'
                }}
              >
                <Plus size={18} /> 新增資料庫
              </button>
            )}
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          {/* Card 1: Databases Count */}
          <div style={{
            padding: '24px',
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(15,23,42,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#2563eb' }} />
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>資料庫總數</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {databases.length}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>個資料庫</span>
              </div>
            </div>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DatabaseIcon size={26} />
            </div>
          </div>

          {/* Card 2: Tables Count */}
          <div style={{
            padding: '24px',
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(15,23,42,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#10b981' }} />
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>資料表總計</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {totalTablesCount}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>張動態表</span>
              </div>
            </div>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TableIcon size={26} />
            </div>
          </div>

          {/* Card 3: Team Members */}
          <div
            onClick={onShowMembersModal}
            style={{
              padding: '24px',
              backgroundColor: '#ffffff',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(15,23,42,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: onShowMembersModal ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (onShowMembersModal) {
                e.currentTarget.style.borderColor = '#cbd5e1'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.06)'
              }
            }}
            onMouseLeave={(e) => {
              if (onShowMembersModal) {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.03)'
              }
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#f59e0b' }} />
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>協作成員</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {memberCount} <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>位成員</span>
                <ArrowUpRight size={18} color="#f59e0b" style={{ marginLeft: '4px' }} />
              </div>
            </div>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={26} />
            </div>
          </div>

        </div>

        {/* Databases & Tables Grid Header with Search */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.3px' }}>
              <Layers size={22} color="#2563eb" /> 資料庫與資料表捷徑 ({filteredDatabases.length})
            </h2>

            {/* Instant Search Bar */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="搜尋資料庫或資料表..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px 9px 38px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'
                }}
              />
            </div>
          </div>

          {filteredDatabases.length === 0 ? (
            <div style={{
              padding: '60px 40px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '2px dashed #cbd5e1',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderPlus size={32} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                {searchQuery ? `找不到符合「${searchQuery}」的資料庫` : '目前工作區尚未建立任何資料庫'}
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 12px 0', maxWidth: '440px', lineHeight: 1.5 }}>
                {searchQuery ? '請嘗試清除搜尋關鍵字，或直接建立新資料庫。' : '點擊下方按鈕立即建立您的第一個雲端資料庫！'}
              </p>
              {activeWorkspace && onShowDatabaseModal && (
                <button
                  onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={18} /> 建立第一個資料庫
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
              {filteredDatabases.map(db => (
                <div key={db.id} style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  padding: '24px',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,23,42,0.08)'
                  e.currentTarget.style.borderColor = '#cbd5e1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.03)'
                  e.currentTarget.style.borderColor = '#e2e8f0'
                }}>
                  {/* Database Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <DatabaseIcon size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {db.name}
                        </h3>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                          {db.tables?.length || 0} 張資料表
                        </span>
                      </div>
                    </div>

                    {onShowCreateTableModal && (
                      <button
                        onClick={() => onShowCreateTableModal(db.id)}
                        title="在此資料庫建立新資料表"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#eff6ff'
                          e.currentTarget.style.borderColor = '#bfdbfe'
                          e.currentTarget.style.color = '#2563eb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.color = '#334155'
                        }}
                      >
                        <Plus size={14} /> 新增表
                      </button>
                    )}
                  </div>

                  {/* Table Items List */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {db.tables && db.tables.length > 0 ? (
                      db.tables.map(table => (
                        <button
                          key={table.id}
                          onClick={() => onSelectTable(table.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff'
                            e.currentTarget.style.borderColor = '#bfdbfe'
                            e.currentTarget.style.color = '#1d4ed8'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc'
                            e.currentTarget.style.borderColor = '#e2e8f0'
                            e.currentTarget.style.color = '#334155'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            <TableIcon size={16} color="#3b82f6" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.name}</span>
                          </div>
                          <ChevronRight size={16} color="#94a3b8" />
                        </button>
                      ))
                    ) : (
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px dashed #cbd5e1',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '12.5px'
                      }}>
                        尚無資料表，點擊右上角「+ 新增表」開始建立
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
