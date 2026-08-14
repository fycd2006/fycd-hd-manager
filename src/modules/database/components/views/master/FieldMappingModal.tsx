import React, { useState } from 'react'
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
  const [targetMergeColName, setTargetMergeColName] = useState<string>('')

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

  // Separate multi-source merged columns vs single-source columns
  const mergedColumns = unifiedColumns.filter((c) => c.sources.length > 1)
  const singleColumns = unifiedColumns.filter((c) => c.sources.length === 1)


  const handleToggleUnmerge = (colKey: string) => {
    if (unmergedKeys.includes(colKey)) {
      setUnmergedKeys((prev) => prev.filter((k) => k !== colKey))
    } else {
      setUnmergedKeys((prev) => [...prev, colKey])
    }
  }

  const handleMapFieldToColumn = (rawFieldKey: string, targetCol: string) => {
    if (!targetCol) {
      // Remove alias
      setCustomAliasMap((prev) => {
        const next = { ...prev }
        delete next[rawFieldKey]
        return next
      })
      return
    }

    setCustomAliasMap((prev) => ({
      ...prev,
      [rawFieldKey]: targetCol,
    }))
    // Also remove from unmergedKeys if present
    setUnmergedKeys((prev) => prev.filter((k) => k !== rawFieldKey && k !== targetCol))
  }

  const handleResetToAuto = () => {
    setUnmergedKeys([])
    setCustomAliasMap({})
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
          maxWidth: '860px',
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
                backgroundColor: '#f7fee7',
                border: '1px solid #d9f99d',
                color: '#3F6212',
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
                檢查系統自動偵測之對齊結果，可手動將同義詞欄位合併，或拆開不相關的同名欄位。
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
                目前無跨表合併欄位（各表欄位均為獨立顯示）
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
                            <TableIcon size={11} color="#3F6212" />
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

          {/* Right Column: Independent Fields / Synonym Merge Assistant */}
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
              <span>獨立/未合併欄位 ({allRawFields.length})</span>
              <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 400 }}>
                手動指定同義詞歸併
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {allRawFields.map((field) => {
                const currentAlias = customAliasMap[field.fieldKey] || customAliasMap[field.name] || ''
                const isUnmerged = unmergedKeys.includes(field.name) || unmergedKeys.includes(field.fieldKey)

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
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#18181b' }}>
                        {field.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#71717a' }}>
                        {field.tableName} · {field.type}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        }}
                      >
                        <option value="">獨立顯示 (不歸併)</option>
                        {Array.from(new Set(allRawFields.map((f) => f.name))).map((name, optIdx) => (
                          <option key={`target-opt-${name}-${optIdx}`} value={name}>
                            歸併至「{name}」
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}

            </div>
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
                backgroundColor: '#3F6212',
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
