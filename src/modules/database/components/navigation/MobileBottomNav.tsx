'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Home, Database as DatabaseIcon, Search, Bell, Settings, X, Table as TableIcon, ChevronRight, Check } from 'lucide-react'
import type { Workspace, User, TableField, TableRow } from '@/modules/database/types'
import MobileSearchModal from './MobileSearchModal'

interface MobileBottomNavProps {
  workspaces: Workspace[]
  activeWorkspaceId: number | null
  activeTableId: number | null
  currentUser: User | null
  notificationCount?: number
  fields?: TableField[]
  rows?: TableRow[]
  onSelectDashboard: () => void
  onSetActiveWorkspaceId: (wsId: number) => void
  onSetActiveTableId: (tableId: number) => void
  onShowNotificationsModal: () => void
  onShowUserSettingsModal: () => void
  onSelectRow?: (row: TableRow) => void
}

export default function MobileBottomNav({
  workspaces = [],
  activeWorkspaceId,
  activeTableId,
  currentUser,
  notificationCount = 0,
  fields = [],
  rows = [],
  onSelectDashboard,
  onSetActiveWorkspaceId,
  onSetActiveTableId,
  onShowNotificationsModal,
  onShowUserSettingsModal,
  onSelectRow
}: MobileBottomNavProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'database' | 'search' | 'alerts' | 'settings'>('home')
  const [showDbModal, setShowDbModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync activeTab when table changes externally
  useEffect(() => {
    if (activeTableId === 0 || activeTableId === null) {
      setActiveTab('home')
    } else {
      setActiveTab('database')
    }
  }, [activeTableId])

  if (!mounted) return null

  // Fallback safety
  const safeWorkspaces = workspaces && workspaces.length > 0 ? workspaces : []
  const activeWorkspace = safeWorkspaces.find(w => w.id === activeWorkspaceId) || safeWorkspaces[0]

  const portalContent = (
    <>
      <style>{`
        @media (min-width: 1024px) {
          .ui-ux-mobile-bottom-nav-portal { display: none !important; }
        }
        @media (max-width: 1023px) {
          .ui-ux-mobile-bottom-nav-portal { display: flex !important; }
        }
      `}</style>

      {/* Floating Centered Glass Capsule Navigation Bar */}
      <nav
        className="ui-ux-mobile-bottom-nav-portal"
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 48px)',
          maxWidth: '400px',
          height: '52px',
          zIndex: 99999999,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: 'none',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.16)',
          borderRadius: '9999px',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 6px',
          pointerEvents: 'auto',
          touchAction: 'manipulation',
        }}
        aria-label="手機端主導向列"
      >
        {/* Tab 1: Home Dashboard */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveTab('home')
            setShowDbModal(false)
            setShowSearchModal(false)
            onSelectDashboard()
          }}
          className={`flex items-center justify-center min-w-[54px] min-h-[40px] px-2.5 py-1 rounded-full transition-all duration-200 active:scale-95 ${
            activeTab === 'home'
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 scale-105 space-x-1'
              : 'text-slate-500 hover:text-slate-900 flex-col'
          }`}
        >
          <Home className={activeTab === 'home' ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
          <span className={activeTab === 'home' ? 'text-xs font-bold' : 'text-[10px] font-medium tracking-tight mt-0.5'}>
            首頁
          </span>
        </button>

        {/* Tab 2: Databases & Tables Modal */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveTab('database')
            setShowSearchModal(false)
            setShowDbModal(prev => !prev)
          }}
          className={`flex items-center justify-center min-w-[54px] min-h-[40px] px-2.5 py-1 rounded-full transition-all duration-200 active:scale-95 ${
            activeTab === 'database' || showDbModal
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 scale-105 space-x-1'
              : 'text-slate-500 hover:text-slate-900 flex-col'
          }`}
        >
          <DatabaseIcon className={activeTab === 'database' || showDbModal ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
          <span className={activeTab === 'database' || showDbModal ? 'text-xs font-bold' : 'text-[10px] font-medium tracking-tight mt-0.5'}>
            資料庫
          </span>
        </button>

        {/* Tab 3: Search */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveTab('search')
            setShowDbModal(false)
            setShowSearchModal(true)
          }}
          className={`flex items-center justify-center min-w-[54px] min-h-[40px] px-2.5 py-1 rounded-full transition-all duration-200 active:scale-95 ${
            activeTab === 'search' || showSearchModal
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 scale-105 space-x-1'
              : 'text-slate-500 hover:text-slate-900 flex-col'
          }`}
        >
          <Search className={activeTab === 'search' || showSearchModal ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
          <span className={activeTab === 'search' || showSearchModal ? 'text-xs font-bold' : 'text-[10px] font-medium tracking-tight mt-0.5'}>
            搜尋
          </span>
        </button>

        {/* Tab 4: Notifications */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveTab('alerts')
            setShowDbModal(false)
            setShowSearchModal(false)
            onShowNotificationsModal()
          }}
          className={`relative flex items-center justify-center min-w-[54px] min-h-[40px] px-2.5 py-1 rounded-full transition-all duration-200 active:scale-95 ${
            activeTab === 'alerts'
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 scale-105 space-x-1'
              : 'text-slate-500 hover:text-slate-900 flex-col'
          }`}
        >
          <Bell className={activeTab === 'alerts' ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
          <span className={activeTab === 'alerts' ? 'text-xs font-bold' : 'text-[10px] font-medium tracking-tight mt-0.5'}>
            通知
          </span>
          {notificationCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Tab 5: Settings */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveTab('settings')
            setShowDbModal(false)
            setShowSearchModal(false)
            onShowUserSettingsModal()
          }}
          className={`flex items-center justify-center min-w-[54px] min-h-[40px] px-2.5 py-1 rounded-full transition-all duration-200 active:scale-95 ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 scale-105 space-x-1'
              : 'text-slate-500 hover:text-slate-900 flex-col'
          }`}
        >
          <Settings className={activeTab === 'settings' ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
          <span className={activeTab === 'settings' ? 'text-xs font-bold' : 'text-[10px] font-medium tracking-tight mt-0.5'}>
            設定
          </span>
        </button>
      </nav>

      {/* Independent Mobile Search Modal */}
      <MobileSearchModal
        show={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        fields={fields}
        rows={rows}
        onSelectRow={onSelectRow}
      />

      {/* Database & Table Selector Modal - Soft Borderless Elevated Style */}
      {showDbModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto',
            touchAction: 'manipulation'
          }}
          onClick={() => setShowDbModal(false)}
        >
          {/* Soft Borderless Card */}
          <div
            style={{
              width: '500px',
              maxWidth: '92vw',
              maxHeight: '80vh',
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.22)',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="選擇資料庫與資料表"
          >
            {/* Header - Borderless Spacing */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 12px 24px',
                backgroundColor: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DatabaseIcon size={18} color="#2563eb" />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                  資料庫與資料表
                </h3>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  borderRadius: '9999px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px 24px' }}>
              {/* Workspace Selector Tabs */}
              {safeWorkspaces.length > 1 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    工作區 (Workspaces)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {safeWorkspaces.map(ws => (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => onSetActiveWorkspaceId(ws.id)}
                        style={{
                          padding: '7px 16px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          backgroundColor: activeWorkspaceId === ws.id ? '#2563eb' : '#f1f5f9',
                          color: activeWorkspaceId === ws.id ? '#ffffff' : '#475569',
                          border: 'none'
                        }}
                      >
                        {ws.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Databases & Tables List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeWorkspace && activeWorkspace.databases && activeWorkspace.databases.length > 0 ? (
                  activeWorkspace.databases.map(db => (
                    <div key={db.id} style={{ backgroundColor: '#f8fafc', border: 'none', borderRadius: '16px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 2px' }}>
                        <DatabaseIcon size={16} color="#2563eb" />
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{db.name}</h4>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {db.tables && db.tables.map(table => {
                          const isSelected = activeTableId === table.id
                          return (
                            <button
                              key={table.id}
                              type="button"
                              onClick={() => {
                                onSetActiveTableId(table.id)
                                setShowDbModal(false)
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                                color: isSelected ? '#ffffff' : '#334155',
                                border: 'none',
                                boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.25)' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                <TableIcon size={16} color={isSelected ? '#ffffff' : '#2563eb'} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.name}</span>
                              </div>
                              {isSelected ? (
                                <Check size={16} color="#ffffff" style={{ flexShrink: 0 }} />
                              ) : (
                                <ChevronRight size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                    尚無資料庫或載入中...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return createPortal(portalContent, document.body)
}
