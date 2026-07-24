'use client'

import React, { useState } from 'react'
import type { User, Workspace, Database, DynamicTable } from '@/modules/database/types'
import { 
  Building2, Database as DatabaseIcon, Table as TableIcon, Users, Plus, 
  Sparkles, ArrowRight, FolderPlus, Layers, CheckCircle2, Clock, 
  Briefcase, DollarSign, UserCheck, CheckSquare, ChevronRight
} from 'lucide-react'

interface WorkspaceDashboardProps {
  currentUser: User
  activeWorkspace: Workspace | null
  workspaces: Workspace[]
  onSelectTable: (tableId: number) => void
  onCreateDatabaseFromTemplate: (templateKey: 'project' | 'crm' | 'finance' | 'hr') => Promise<void>
  onShowMembersModal?: () => void
  onShowDatabaseModal?: (wsId: number) => void
}

export default function WorkspaceDashboard({
  currentUser,
  activeWorkspace,
  workspaces,
  onSelectTable,
  onCreateDatabaseFromTemplate,
  onShowMembersModal,
  onShowDatabaseModal
}: WorkspaceDashboardProps) {
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null)

  // Calculate statistics
  const databases: Database[] = activeWorkspace?.databases || []
  const totalTablesCount = databases.reduce((acc, db) => acc + (db.tables?.length || 0), 0)

  const handleLaunchTemplate = async (key: 'project' | 'crm' | 'finance' | 'hr') => {
    setCreatingTemplate(key)
    try {
      await onCreateDatabaseFromTemplate(key)
    } finally {
      setCreatingTemplate(null)
    }
  }

  const TEMPLATES = [
    {
      key: 'project' as const,
      name: '🚀 專案任務追蹤 (Project Tracker)',
      desc: '追蹤專案進度、任務狀態、優先級與團隊截止日期。包含 Kanban 看板與時間軸。',
      icon: CheckSquare,
      color: '#2563eb',
      bgColor: '#eff6ff',
      fields: ['任務名稱', '狀態', '優先級', '負責人', '截止日期']
    },
    {
      key: 'crm' as const,
      name: '💼 客戶關係 CRM (Customer CRM)',
      desc: '管理客戶聯絡資訊、交易金額、溝通階段與銷售管道進度。',
      icon: Briefcase,
      color: '#0284c7',
      bgColor: '#f0f9ff',
      fields: ['客戶姓名', '公司名稱', '聯絡電話', '電子郵件', '交易金額', '狀態']
    },
    {
      key: 'finance' as const,
      name: '💰 團隊財務記帳 (Financial Expense)',
      desc: '管理收支明細、費用類別、收據附件與預算統計。',
      icon: DollarSign,
      color: '#16a34a',
      bgColor: '#f0fdf4',
      fields: ['收支項目', '類別', '金額', '日期', '付款方式']
    },
    {
      key: 'hr' as const,
      name: '👥 人事資料庫 (HR Directory)',
      desc: '維護員工基本資料、部門分組、入職日期與職稱聯絡通訊錄。',
      icon: UserCheck,
      color: '#d97706',
      bgColor: '#fffbeb',
      fields: ['員工姓名', '部門', '職稱', '入職日期', '聯絡電話']
    }
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', backgroundColor: 'var(--bg-primary, #f8fafc)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Banner Section */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
          borderRadius: '20px',
          padding: '36px 40px',
          color: '#ffffff',
          boxShadow: '0 20px 40px -15px rgba(37,99,235,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '650px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              padding: '4px 12px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px'
            }}>
              <Sparkles size={14} /> 歡迎回來，{currentUser.username}！
            </span>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.3 }}>
              {activeWorkspace?.name || '預設工作區'} 儀表板總覽
            </h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>
              高效管理雲端資料庫、動態資料表與自動化計算公式。您可以從下方建立空白資料庫或一鍵套用熱門範本。
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 2 }}>
            {activeWorkspace && onShowDatabaseModal && (
              <button
                onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  color: '#1d4ed8',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Plus size={18} /> 新增空白資料庫
              </button>
            )}
          </div>
        </div>

        {/* Metrics Overview Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          
          <div style={{ padding: '20px 24px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DatabaseIcon size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>資料庫總數</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{databases.length} <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>個</span></div>
            </div>
          </div>

          <div style={{ padding: '20px 24px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TableIcon size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>資料表總數</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{totalTablesCount} <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>張</span></div>
            </div>
          </div>

          <div
            onClick={onShowMembersModal}
            style={{ padding: '20px 24px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px', cursor: onShowMembersModal ? 'pointer' : 'default' }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>團隊成員</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                管理協作成員 ➔
              </div>
            </div>
          </div>

        </div>

        {/* Databases & Tables Quick Launch */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#2563eb" /> 工作區資料庫與資料表 ({databases.length})
            </h2>
          </div>

          {databases.length === 0 ? (
            <div style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px dashed #cbd5e1', textAlign: 'center' }}>
              <FolderPlus size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>目前工作區尚未建立任何資料庫</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>請點擊上方按鈕建立全新資料庫，或從下方一鍵套用範本！</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {databases.map(db => (
                <div key={db.id} style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DatabaseIcon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {db.name}
                      </h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{db.tables?.length || 0} 張資料表</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {db.tables && db.tables.length > 0 ? (
                      db.tables.map(table => (
                        <button
                          key={table.id}
                          onClick={() => onSelectTable(table.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            fontSize: '13px',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <TableIcon size={14} color="#64748b" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.name}</span>
                          </div>
                          <ChevronRight size={14} />
                        </button>
                      ))
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>尚無資料表</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Gallery Section */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#d97706" /> 快速範本庫 (One-Click Templates)
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>選擇下方熱門行業與業務範本，一鍵建立對應的資料庫、預設欄位與範例資料紀錄。</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '20px' }}>
            {TEMPLATES.map(tpl => {
              const IconComp = tpl.icon
              const isBusy = creatingTemplate === tpl.key

              return (
                <div
                  key={tpl.key}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: tpl.bgColor, color: tpl.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                      <IconComp size={22} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>{tpl.name}</h3>
                    <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.5 }}>{tpl.desc}</p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {tpl.fields.map((f, idx) => (
                        <span key={idx} style={{ fontSize: '11px', padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '10px' }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleLaunchTemplate(tpl.key)}
                    disabled={isBusy}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: isBusy ? '#93c5fd' : tpl.bgColor,
                      color: isBusy ? '#ffffff' : tpl.color,
                      border: `1px solid ${tpl.color}30`,
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: isBusy ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isBusy ? '建立中...' : '使用此範本建立資料庫'}
                    {!isBusy && <ArrowRight size={15} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
