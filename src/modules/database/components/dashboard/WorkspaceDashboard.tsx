'use client'

import React, { useState, useMemo } from 'react'
import type { User, Workspace, Database } from '@/modules/database/types'
import { 
  Database as DatabaseIcon, Table as TableIcon, Users, Plus, 
  Sparkles, FolderPlus, Layers, ChevronRight, Search,
  ArrowUpRight, ShieldCheck, Activity, Filter, Command,
  ArrowRight, Clock, Zap
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

/**
 * Design Read:
 * "Reading this as: No-Code Cloud Database Workspace Dashboard for technical & business teams,
 * with a Linear-style minimalist & data-dense language, leaning toward Geist/Satoshi aesthetics,
 * subtle micro-interactions, crisp monochrome layout with electric blue accent lock."
 * Dials: DESIGN_VARIANCE: 7 | MOTION_INTENSITY: 6 | VISUAL_DENSITY: 4
 */
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
  const totalTablesCount = useMemo(() => {
    return databases.reduce((acc, db) => acc + (db.tables?.length || 0), 0)
  }, [databases])

  const memberCount = activeWorkspace?.members?.length || 1

  // Filter databases & tables based on search query
  const filteredDatabases = useMemo(() => {
    if (!searchQuery.trim()) return databases
    const q = searchQuery.toLowerCase().trim()
    return databases.map(db => {
      const dbMatch = db.name.toLowerCase().includes(q)
      const matchingTables = (db.tables || []).filter(t => t.name.toLowerCase().includes(q))
      if (dbMatch) return db
      if (matchingTables.length > 0) {
        return { ...db, tables: matchingTables }
      }
      return null
    }).filter(Boolean) as Database[]
  }, [databases, searchQuery])

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      height: '100%',
      backgroundColor: '#fafafa',
      fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#09090b',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '40px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '36px'
      }}>
        
        {/* Top Header / Workspace Identity Strip */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          borderBottom: '1px solid #e4e4e7',
          paddingBottom: '28px'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#52525b',
              backgroundColor: '#f4f4f5',
              padding: '4px 10px',
              borderRadius: '6px',
              marginBottom: '12px',
              border: '1px solid #e4e4e7'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block'
              }} />
              工作區首頁 · {currentUser.username} ({currentUser.role === 'admin' ? '管理者' : '成員'})
            </div>
            
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 6px 0',
              color: '#09090b',
              lineHeight: 1.2
            }}>
              {activeWorkspace?.name || '雲端工作區'} 概覽
            </h1>
            
            <p style={{
              fontSize: '14px',
              color: '#71717a',
              margin: 0,
              fontWeight: 400
            }}>
              瀏覽與存取雲端資料庫、管理成員權限與資料表動態結構。
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onShowMembersModal && (
              <button
                onClick={onShowMembersModal}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#27272a',
                  border: '1px solid #e4e4e7',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f4f4f5'
                  e.currentTarget.style.borderColor = '#d4d4d8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.borderColor = '#e4e4e7'
                }}
              >
                <Users size={15} color="#52525b" /> 協作成員 ({memberCount})
              </button>
            )}

            {activeWorkspace && onShowDatabaseModal && (
              <button
                onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                style={{
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  backgroundColor: '#09090b',
                  color: '#ffffff',
                  border: '1px solid #09090b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#27272a'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#09090b'
                }}
              >
                <Plus size={16} /> 新增資料庫
              </button>
            )}
          </div>
        </div>

        {/* Minimalist Linear-Style Data Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {/* Metric 1 */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e4e4e7',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                DATABASE COUNT
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090b', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {databases.length}
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#a1a1aa', marginLeft: '6px' }}>個</span>
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#f4f4f5',
              color: '#18181b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DatabaseIcon size={20} />
            </div>
          </div>

          {/* Metric 2 */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e4e4e7',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL TABLES
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090b', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {totalTablesCount}
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#a1a1aa', marginLeft: '6px' }}>張</span>
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TableIcon size={20} />
            </div>
          </div>

          {/* Metric 3 */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e4e4e7',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                SYSTEM STATUS
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#10b981" /> 運作正常 (100% 正常)
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={20} />
            </div>
          </div>
        </div>

        {/* Database & Table Explorer Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section Bar + Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#09090b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '-0.01em'
            }}>
              <Layers size={18} color="#2563eb" /> 資料庫清單 ({filteredDatabases.length})
            </h2>

            {/* Clean Command Search Bar */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={15} color="#a1a1aa" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="搜尋資料庫或資料表..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px 0 36px',
                  borderRadius: '8px',
                  border: '1px solid #e4e4e7',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#09090b',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e4e4e7'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          {/* Database Grid Cards */}
          {filteredDatabases.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px dashed #d4d4d8',
              padding: '50px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#f4f4f5',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FolderPlus size={24} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#18181b' }}>
                {searchQuery ? `找不到符合「${searchQuery}」的資料庫` : '工作區尚無資料庫'}
              </div>
              <div style={{ fontSize: '13px', color: '#71717a', maxWidth: '380px' }}>
                {searchQuery ? '請嘗試更換搜尋關鍵字。' : '點擊上方按鈕建立第一個雲端資料庫。'}
              </div>
              {activeWorkspace && onShowDatabaseModal && !searchQuery && (
                <button
                  onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                  style={{
                    marginTop: '8px',
                    height: '36px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  建立資料庫
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '20px'
            }}>
              {filteredDatabases.map(db => (
                <div
                  key={db.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e4e4e7',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e4e4e7'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Database Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <DatabaseIcon size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#09090b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {db.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#71717a', fontWeight: 500 }}>
                          {db.tables?.length || 0} 張資料表
                        </div>
                      </div>
                    </div>

                    {onShowCreateTableModal && (
                      <button
                        onClick={() => onShowCreateTableModal(db.id)}
                        style={{
                          height: '28px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          backgroundColor: '#f4f4f5',
                          border: '1px solid #e4e4e7',
                          color: '#27272a',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#eff6ff'
                          e.currentTarget.style.color = '#2563eb'
                          e.currentTarget.style.borderColor = '#bfdbfe'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f4f4f5'
                          e.currentTarget.style.color = '#27272a'
                          e.currentTarget.style.borderColor = '#e4e4e7'
                        }}
                      >
                        <Plus size={13} /> 新增表
                      </button>
                    )}
                  </div>

                  {/* Table Item List */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    borderTop: '1px solid #f4f4f5',
                    paddingTop: '12px'
                  }}>
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
                            borderRadius: '6px',
                            backgroundColor: '#fafafa',
                            border: '1px solid #f4f4f5',
                            color: '#27272a',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.12s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff'
                            e.currentTarget.style.borderColor = '#dbeafe'
                            e.currentTarget.style.color = '#1d4ed8'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fafafa'
                            e.currentTarget.style.borderColor = '#f4f4f5'
                            e.currentTarget.style.color = '#27272a'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <TableIcon size={14} color="#3b82f6" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {table.name}
                            </span>
                          </div>
                          <ChevronRight size={14} color="#a1a1aa" />
                        </button>
                      ))
                    ) : (
                      <div style={{
                        fontSize: '12px',
                        color: '#a1a1aa',
                        padding: '8px 0',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        尚無資料表
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
