import React, { useState, useEffect } from 'react'
import {
  X,
  Layers,
  AlertTriangle,
  Split,
  Merge,
  RotateCcw,
  Check,
  Table as TableIcon,
  HelpCircle,
  Plus,
} from 'lucide-react'
import {
  type MasterFieldInfo,
  type UnifiedColumnInfo,
  buildUnifiedColumns,
} from '@/modules/database/services/multiTableUtils'

export interface FieldMappingModalProps {
  show: boolean
  onClose: () => void
  fieldsMap: Record<string, MasterFieldInfo>
  tablesMap?: Record<number, { name: string; color?: string }>
  unmergedKeys: string[]
  customAliasMap: Record<string, string>
  onApplyMapping: (unmergedKeys: string[], customAliasMap: Record<string, string>) => void
}

export const FieldMappingModal: React.FC<FieldMappingModalProps> = ({
  show,
  onClose,
  fieldsMap,
  tablesMap = {},
  unmergedKeys: initialUnmergedKeys,
  customAliasMap: initialCustomAliasMap,
  onApplyMapping,
}) => {
  const [unmergedKeys, setUnmergedKeys] = useState<string[]>(initialUnmergedKeys)
  const [customAliasMap, setCustomAliasMap] = useState<Record<string, string>>(initialCustomAliasMap)
  const [newCustomTargetName, setNewCustomTargetName] = useState<string>('')
  const [customTargetNames, setCustomTargetNames] = useState<string[]>([])

  // Synchronize internal state with external props on modal open or when props update
  useEffect(() => {
    if (show) {
      setUnmergedKeys(initialUnmergedKeys || [])
      setCustomAliasMap(initialCustomAliasMap || {})
      setNewCustomTargetName('')
    }
  }, [show, initialUnmergedKeys, initialCustomAliasMap])

  // Compute unified preview based on current modal state
  const unifiedColumns = buildUnifiedColumns(fieldsMap, unmergedKeys, tablesMap, customAliasMap)

  // Find all raw field keys and strictly deduplicate by (tableId, fieldKey)
  const allRawFields = React.useMemo(() => {
    const seen = new Set<string>()
    const result = []

    for (const [key, f] of Object.entries(fieldsMap || {})) {
      if (!f || typeof f !== 'object') continue
      const fieldKey = key.startsWith('field_') ? key : `field_${f.id}`
      const uniqueId = `${f.tableId}-${fieldKey}`
      if (seen.has(uniqueId)) continue
      seen.add(uniqueId)

      result.push({
        fieldKey,
        tableId: f.tableId,
        tableName: tablesMap[f.tableId]?.name || `Table ${f.tableId}`,
        name: f.name || fieldKey,
        type: f.type || 'text',
      })
    }
    return result
  }, [fieldsMap, tablesMap])

  // Available target column names for merging
  const availableTargetOptions = React.useMemo(() => {
    const names = new Set<string>()
    allRawFields.forEach((f) => {
      const trimmed = f.name?.trim()
      if (trimmed) names.add(trimmed)
    })
    customTargetNames.forEach((n) => {
      const trimmed = n.trim()
      if (trimmed) names.add(trimmed)
    })
    Object.values(customAliasMap).forEach((val) => {
      if (val && typeof val === 'string' && val.trim()) {
        names.add(val.trim())
      }
    })
    return Array.from(names)
  }, [allRawFields, customTargetNames, customAliasMap])

  // Detect same-table field collision for a target column name
  const isSameTableCollision = (targetName: string, currentField: (typeof allRawFields)[0]) => {
    return allRawFields.some((other) => {
      if (other.tableId !== currentField.tableId) return false
      if (other.fieldKey === currentField.fieldKey) return false

      const otherTarget = customAliasMap[other.fieldKey] || other.name
      return otherTarget === targetName
    })
  }

  // Separate multi-source merged columns
  const mergedColumns = unifiedColumns.filter((c) => c.sources.length > 1)

  // Independent / unmerged fields: strictly all raw fields that are NOT part of any merged column
  const independentFields = React.useMemo(() => {
    const mergedFieldKeySet = new Set<string>()
    mergedColumns.forEach((col) => {
      col.sources.forEach((s) => {
        mergedFieldKeySet.add(`${s.tableId}-${s.fieldKey}`)
      })
    })

    return allRawFields.filter((f) => !mergedFieldKeySet.has(`${f.tableId}-${f.fieldKey}`))
  }, [allRawFields, mergedColumns])

  const handleAddCustomTarget = () => {
    const trimmed = newCustomTargetName.trim()
    if (!trimmed) return
    if (!customTargetNames.includes(trimmed)) {
      setCustomTargetNames((prev) => [...prev, trimmed])
    }
    setNewCustomTargetName('')
  }

  const handleToggleUnmerge = (colKey: string) => {
    const targetCol = unifiedColumns.find((c) => c.key === colKey)
    if (unmergedKeys.includes(colKey)) {
      setUnmergedKeys((prev) => prev.filter((k) => k !== colKey && k !== targetCol?.name))
    } else {
      setUnmergedKeys((prev) => [...prev, colKey])
      if (targetCol) {
        setCustomAliasMap((prev) => {
          const next = { ...prev }
          targetCol.sources.forEach((s) => {
            delete next[s.fieldKey]
            delete next[s.fieldName]
          })
          return next
        })
      }
    }
  }

  const handleRestoreAutoMerge = (field: (typeof allRawFields)[0]) => {
    setUnmergedKeys((prev) =>
      prev.filter((k) => k !== field.fieldKey && k !== field.name)
    )
    setCustomAliasMap((prev) => {
      const next = { ...prev }
      delete next[field.fieldKey]
      delete next[field.name]
      return next
    })
  }

  const handleMapFieldToColumn = (rawFieldKey: string, targetCol: string) => {
    const matchedField = allRawFields.find((f) => f.fieldKey === rawFieldKey)
    if (!targetCol) {
      // Remove alias
      setCustomAliasMap((prev) => {
        const next = { ...prev }
        delete next[rawFieldKey]
        if (matchedField?.name) {
          delete next[matchedField.name]
        }
        return next
      })
      return
    }

    setCustomAliasMap((prev) => ({
      ...prev,
      [rawFieldKey]: targetCol,
    }))
    // Also remove from unmergedKeys if present to allow immediate merging
    setUnmergedKeys((prev) =>
      prev.filter(
        (k) =>
          k !== rawFieldKey &&
          k !== targetCol &&
          k !== matchedField?.name
      )
    )
  }

  const handleResetToAuto = () => {
    setUnmergedKeys([])
    setCustomAliasMap({})
    setCustomTargetNames([])
  }

  const handleSave = () => {
    onApplyMapping(unmergedKeys, customAliasMap)
    onClose()
  }

  if (!show) return null

  return (
    <div
      data-testid="field-mapping-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        data-testid="field-mapping-modal"
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e4e4e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#52A628',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#09090b' }}>
                跨表欄位對照與合併確認
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#71717a' }}>
                左側顯示已跨表合併的欄位（可隨時拆散）；右側顯示未合併的獨立欄位（可指定歸併至特定統一欄位）。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-mapping-modal-btn"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#a1a1aa',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '20px',
          }}
        >
          {/* Left Column: Merged Columns (Multi-Source) */}
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#18181b',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>已合併之統一欄位 ({mergedColumns.length})</span>
              <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 400 }}>
                跨 2 個以上子表共用
              </span>
            </div>

            {mergedColumns.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: '#f4f4f5',
                  borderRadius: '8px',
                  border: '1px dashed #d4d4d8',
                  color: '#a1a1aa',
                  fontSize: '12px',
                }}
              >
                目前無跨表合併欄位（所有子表欄位均為獨立顯示）
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mergedColumns.map((col) => (
                  <div
                    key={col.key}
                    data-testid={`mapping-card-${col.key}`}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${col.hasTypeMismatch ? '#fde68a' : '#e4e4e7'}`,
                      backgroundColor: col.hasTypeMismatch ? '#fffbeb' : '#fafafa',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#09090b' }}>
                          {col.name}
                        </span>
                        {col.hasTypeMismatch && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '1px 6px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600,
                            }}
                          >
                            <AlertTriangle size={11} />
                            型別衝突 ({col.mismatchedTypes.join(', ')})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleUnmerge(col.key)}
                        data-testid={`unmerge-col-${col.key}-btn`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e4e4e7',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#52525b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Split size={12} />
                        拆開為個別欄位
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {col.sources.map((s, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            backgroundColor: '#ffffff',
                            borderRadius: '4px',
                            border: '1px solid #e4e4e7',
                            fontSize: '11px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TableIcon size={11} color="#52A628" />
                            <span style={{ fontWeight: 500, color: '#27272a' }}>
                              {s.tableName || `表 ${s.tableId}`}
                            </span>
                            <span style={{ color: '#71717a' }}>/ {s.fieldName}</span>
                          </div>
                          <span style={{ color: '#a1a1aa', fontSize: '10px' }}>{s.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Independent / Unmerged Fields */}
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#18181b',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>獨立/未合併欄位 ({independentFields.length})</span>
              <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 400 }}>
                指定歸併目標
              </span>
            </div>

            {/* Quick Add Custom Target Name */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <input
                type="text"
                data-testid="new-custom-target-input"
                placeholder="自訂新統一欄位 (如: 統編/稅號)..."
                value={newCustomTargetName}
                onChange={(e) => setNewCustomTargetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomTarget()
                  }
                }}
                style={{
                  flex: 1,
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e4e4e7',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleAddCustomTarget}
                disabled={!newCustomTargetName.trim()}
                data-testid="add-custom-target-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '4px 8px',
                  backgroundColor: newCustomTargetName.trim() ? '#f0fdf4' : '#f4f4f5',
                  color: newCustomTargetName.trim() ? '#166534' : '#a1a1aa',
                  border: `1px solid ${newCustomTargetName.trim() ? '#86efac' : '#e4e4e7'}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: newCustomTargetName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Plus size={12} />
                新增目標
              </button>
            </div>

            {independentFields.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: '#f4f4f5',
                  borderRadius: '8px',
                  border: '1px dashed #d4d4d8',
                  color: '#a1a1aa',
                  fontSize: '12px',
                }}
              >
                目前所有子表欄位均已完成跨表合併
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                }}
              >
                {independentFields.map((field) => {
                  const currentAlias = customAliasMap[field.fieldKey] || customAliasMap[field.name] || ''
                  const isManuallyUnmerged =
                    unmergedKeys.includes(field.name) ||
                    unmergedKeys.includes(field.fieldKey) ||
                    unmergedKeys.includes(currentAlias)

                  return (
                    <div
                      key={`${field.tableId}-${field.fieldKey}`}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e4e4e7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#18181b' }}>
                            {field.name}
                          </span>
                          {isManuallyUnmerged && (
                            <span
                              style={{
                                fontSize: '9px',
                                padding: '1px 4px',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                borderRadius: '3px',
                                fontWeight: 500,
                              }}
                            >
                              手動拆分
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#71717a' }}>
                          {field.tableName} · {field.type}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isManuallyUnmerged && (
                          <button
                            type="button"
                            onClick={() => handleRestoreAutoMerge(field)}
                            data-testid={`restore-automerge-${field.fieldKey}`}
                            style={{
                              border: '1px solid #d9f99d',
                              backgroundColor: '#f7fee7',
                              color: '#365314',
                              borderRadius: '4px',
                              fontSize: '10px',
                              padding: '2px 6px',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            恢復自動合併
                          </button>
                        )}
                        <select
                          value={currentAlias}
                          data-testid={`merge-select-${field.fieldKey}`}
                          onChange={(e) => handleMapFieldToColumn(field.fieldKey, e.target.value)}
                          style={{
                            fontSize: '11px',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${currentAlias ? '#bef264' : '#e4e4e7'}`,
                            backgroundColor: currentAlias ? '#f7fee7' : '#ffffff',
                            color: currentAlias ? '#365314' : '#52525b',
                            fontWeight: currentAlias ? 600 : 400,
                            maxWidth: '160px',
                          }}
                        >
                          <option value="">保持獨立 (不歸併)</option>
                          {availableTargetOptions
                            .filter((name) => name !== field.name || currentAlias === name)
                            .map((name, optIdx) => {
                              const isCollision = isSameTableCollision(name, field)
                              return (
                                <option
                                  key={`target-opt-${name}-${optIdx}`}
                                  value={name}
                                  disabled={isCollision}
                                >
                                  歸併至「{name}」{isCollision ? ' (同表已佔用)' : ''}
                                </option>
                              )
                            })}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>



        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e4e4e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafafa',
          }}
        >
          <button
            onClick={handleResetToAuto}
            data-testid="reset-mapping-auto-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#52525b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={13} />
            重置為同名自動對照
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#52525b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              data-testid="apply-mapping-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 16px',
                backgroundColor: '#52A628',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Check size={14} />
              套用對照設定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
