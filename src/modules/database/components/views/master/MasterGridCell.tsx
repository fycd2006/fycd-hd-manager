import React, { memo } from 'react'
import {
  Link2,
  Paperclip,
  RotateCcw,
  Loader2,
  User,
  MessageSquare,
  Star,
  Mail,
  Clock,
  Sparkles,
} from 'lucide-react'
import { formatDateValue } from '@/modules/database/utils'
import {
  parseSelectItems,
  getOptionColor,
  formatNumberValue,
} from '@/modules/database/components/views/grid/cells/utils'
import { renderFormulaCell } from '@/modules/database/components/views/grid/cells/FormulaCell'
import { parseLatestCommentEntries } from '@/modules/database/components/views/grid/GridViewCell'
import type { MasterViewRowWithOverrides } from '@/modules/database/services/masterViewOverride'
import {
  type MasterFieldInfo,
  type UnifiedColumnInfo,
  getRowFieldValue,
  mergeFieldOptions,
  extractChoicesList,
} from '@/modules/database/services/multiTableUtils'

export interface MasterGridCellProps {
  row: MasterViewRowWithOverrides
  fieldKey: string
  rowIndex: number
  unifiedColumnsMap: Record<string, UnifiedColumnInfo>
  fieldsMap: Record<string, MasterFieldInfo>
  isPinned: boolean
  stickyLeft?: string
  isOverridden: boolean
  originalVal: any
  activeOverridePopover: { tableId: number; rowId: number; key: string } | null
  revertingOverride: boolean
  onToggleOverridePopover: (popover: { tableId: number; rowId: number; key: string } | null) => void
  onRevertOverride: (tableId: number, rowId: number, key: string) => void
  onOpenDrawer: (params: { tableId: number; rowId: number; tableName: string }) => void
}

/**
 * Pure cell value renderer for Master View table rows.
 */
function renderCellValueContent(
  row: MasterViewRowWithOverrides,
  key: string,
  unifiedColumnsMap: Record<string, UnifiedColumnInfo>,
  fieldsMap: Record<string, MasterFieldInfo>,
  onOpenDrawer: (params: { tableId: number; rowId: number; tableName: string }) => void
) {
  const val = getRowFieldValue(row, key, unifiedColumnsMap, fieldsMap)
  if (val == null || val === '') {
    return <span style={{ color: '#cbd5e1' }}>—</span>
  }

  const unifiedCol = unifiedColumnsMap[key]
  const tableFieldKey = unifiedCol?.tableFieldMap[row.tableId] || key
  const tableFieldInfo = fieldsMap[tableFieldKey] || fieldsMap[key]
  const sampleFieldInfo = unifiedCol ? fieldsMap[`field_${unifiedCol.sampleFieldId}`] : null
  const fieldType = tableFieldInfo?.type || unifiedCol?.type || sampleFieldInfo?.type || 'text'

  // Combine choices from table field, unified column, and all source fields
  let mergedOptions = mergeFieldOptions(unifiedCol?.options, tableFieldInfo?.options)
  mergedOptions = mergeFieldOptions(mergedOptions, sampleFieldInfo?.options)
  if (unifiedCol?.sources) {
    for (const src of unifiedCol.sources) {
      if (fieldsMap[src.fieldKey]?.options) {
        mergedOptions = mergeFieldOptions(mergedOptions, fieldsMap[src.fieldKey]?.options)
      }
    }
  }
  const options = mergedOptions

  // 1. Single Select / Multiple Select
  if (fieldType === 'single_select' || fieldType === 'multiple_select') {
    const items = parseSelectItems(val, mergedOptions)
    if (items.length > 0) {
      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
          {items.map((itemStr, i) => {
            const isUuidPattern = (s: string) =>
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
              /^[0-9a-f]{24,}$/i.test(s.trim())

            let displayLabel = itemStr
            if (isUuidPattern(itemStr) || /^opt_[a-z0-9]+$/i.test(itemStr)) {
              for (const f of Object.values(fieldsMap)) {
                const fChoices = extractChoicesList(f.options)
                const found = fChoices.find(
                  (c: any) =>
                    c &&
                    (String(c.id).toLowerCase() === itemStr.toLowerCase() ||
                      String(c.value).toLowerCase() === itemStr.toLowerCase())
                )
                if (found) {
                  const candidate = found.name || found.label || found.text || found.value || ''
                  if (candidate && !isUuidPattern(candidate)) {
                    displayLabel = candidate
                    break
                  }
                }
              }
            }

            if (isUuidPattern(displayLabel)) {
              return null
            }

            const { bg, text } = getOptionColor(
              displayLabel,
              mergedOptions?.choices || mergedOptions?.select_options || mergedOptions
            )
            return (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 500,
                  backgroundColor: bg,
                  color: text,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={displayLabel}
              >
                {displayLabel}
              </span>
            )
          })}
        </div>
      )
    }
    return <span style={{ color: '#cbd5e1' }}>—</span>
  }

  // 2. Link Row (關聯資料表列)
  if (fieldType === 'link_row') {
    let linkItems: Array<{ id?: number; value: string; tableName?: string }> = []
    if (Array.isArray(val)) {
      linkItems = val.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return {
            id: item.id ? Number(item.id) : undefined,
            value: item.value || item.name || (item.id ? `列 ID: ${item.id}` : ''),
            tableName: item.tableName,
          }
        }
        return { id: Number(item) || undefined, value: `列 ID: ${item}` }
      })
    } else if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          linkItems = parsed.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return {
                id: item.id ? Number(item.id) : undefined,
                value: item.value || item.name || (item.id ? `列 ID: ${item.id}` : ''),
                tableName: item.tableName,
              }
            }
            return { id: Number(item) || undefined, value: `列 ID: ${item}` }
          })
        } else if (typeof parsed === 'object' && parsed !== null) {
          linkItems = [
            {
              id: parsed.id ? Number(parsed.id) : undefined,
              value: parsed.value || parsed.name || (parsed.id ? `列 ID: ${parsed.id}` : ''),
              tableName: parsed.tableName,
            },
          ]
        } else {
          linkItems = [{ value: String(parsed) }]
        }
      } catch {
        linkItems = [{ value: val }]
      }
    } else if (typeof val === 'object' && val !== null) {
      linkItems = [
        {
          id: val.id ? Number(val.id) : undefined,
          value: val.value || val.name || (val.id ? `列 ID: ${val.id}` : ''),
          tableName: val.tableName,
        },
      ]
    }

    if (linkItems.length > 0) {
      const targetTableId = options?.target_table_id || options?.link_table_id
      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
          {linkItems.map((item, i) => (
            <span
              key={i}
              onClick={(e) => {
                if (targetTableId && item.id) {
                  e.stopPropagation()
                  onOpenDrawer({
                    tableId: targetTableId,
                    rowId: item.id,
                    tableName: item.tableName || `資料表 ${targetTableId}`,
                  })
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500,
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                cursor: targetTableId && item.id ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={item.value}
            >
              <Link2 size={11} color="#2563eb" />
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.value || (item.id ? `列 ID: ${item.id}` : '—')}
              </span>
            </span>
          ))}
        </div>
      )
    }
    return <span style={{ color: '#cbd5e1' }}>—</span>
  }

  // 3. Collaborator (協作成員)
  if (fieldType === 'collaborator') {
    let collabItems: Array<{ id?: number; username: string }> = []
    if (Array.isArray(val)) {
      collabItems = val.map((item) =>
        typeof item === 'object' && item !== null
          ? { id: item.id, username: item.username || item.name || `ID: ${item.id}` }
          : { username: String(item) }
      )
    } else if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          collabItems = parsed.map((item: any) =>
            typeof item === 'object' && item !== null
              ? { id: item.id, username: item.username || item.name || `ID: ${item.id}` }
              : { username: String(item) }
          )
        } else if (typeof parsed === 'object' && parsed !== null) {
          collabItems = [{ id: parsed.id, username: parsed.username || parsed.name || `ID: ${parsed.id}` }]
        } else {
          collabItems = [{ username: String(parsed) }]
        }
      } catch {
        collabItems = [{ username: val }]
      }
    } else if (typeof val === 'object' && val !== null) {
      collabItems = [{ id: val.id, username: val.username || val.name || `ID: ${val.id}` }]
    }

    if (collabItems.length > 0) {
      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
          {collabItems.map((item, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 500,
                backgroundColor: '#f5f3ff',
                color: '#6d28d9',
                border: '1px solid #ddd6fe',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <User size={11} color="#7c3aed" />
              <span>{item.username}</span>
            </span>
          ))}
        </div>
      )
    }
    return <span style={{ color: '#cbd5e1' }}>—</span>
  }

  // 4. Latest Comment (最新留言備註)
  if (fieldType === 'latest_comment') {
    const entries = parseLatestCommentEntries(val)
    const latest = entries.length > 0 ? entries[entries.length - 1] : null
    if (latest) {
      const dateOnly = latest.time?.includes(' ')
        ? latest.time.split(' ')[0]
        : latest.time?.includes('T')
        ? latest.time.split('T')[0]
        : latest.time || ''
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            overflow: 'hidden',
            width: '100%',
            padding: '0 4px',
          }}
          title={latest.content}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', flex: 1, minWidth: 0 }}>
            <MessageSquare size={12} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span
              style={{
                fontSize: '12px',
                color: '#334155',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: '1.3',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                flex: 1,
              }}
            >
              {latest.content}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {dateOnly}
          </span>
        </div>
      )
    }
    return <span style={{ color: '#cbd5e1' }}>—</span>
  }

  // 5. File / Attachment (檔案 / 附件)
  if (fieldType === 'file' || fieldType === 'attachment') {
    let fileItems: Array<{ name: string; url?: string }> = []
    if (Array.isArray(val)) {
      fileItems = val.map((f) =>
        typeof f === 'object' && f !== null ? { name: f.name || '檔案', url: f.url } : { name: String(f) }
      )
    } else if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          fileItems = parsed.map((f: any) =>
            typeof f === 'object' && f !== null ? { name: f.name || '檔案', url: f.url } : { name: String(f) }
          )
        } else if (typeof parsed === 'object' && parsed !== null) {
          fileItems = [{ name: parsed.name || '檔案', url: parsed.url }]
        } else {
          fileItems = [{ name: String(parsed) }]
        }
      } catch {
        fileItems = [{ name: val }]
      }
    }
    if (fileItems.length > 0) {
      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
          {fileItems.map((f, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={f.name}
            >
              <Paperclip size={11} color="#64748b" />
              <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
            </span>
          ))}
        </div>
      )
    }
    return <span style={{ color: '#cbd5e1' }}>—</span>
  }

  // 6. Boolean (核取方塊)
  if (fieldType === 'boolean' || typeof val === 'boolean') {
    const isChecked = Boolean(val === true || val === 'true' || val === 1 || val === '1')
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '4px',
            border: isChecked ? '1px solid #52A628' : '1px solid #cbd5e1',
            backgroundColor: isChecked ? '#52A628' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isChecked && (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  // 7. Number (數字 / 貨幣 / 百分比)
  if (['number', 'currency', 'percent', 'autonumber'].includes(fieldType) && (typeof val === 'number' || !isNaN(Number(val)))) {
    const formatted = formatNumberValue(val, options)
    return (
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'monospace',
          fontWeight: 500,
          color: '#1e293b',
        }}
      >
        {formatted}
      </span>
    )
  }

  // 8. Rating (評分星級)
  if (fieldType === 'rating') {
    const ratingVal = Math.min(5, Math.max(0, parseInt(String(val || 0)) || 0))
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((starNum) => (
          <Star
            key={starNum}
            size={13}
            fill={starNum <= ratingVal ? '#f59e0b' : '#e2e8f0'}
            color={starNum <= ratingVal ? '#f59e0b' : '#e4e4e7'}
          />
        ))}
      </div>
    )
  }

  // 9. URL (網址連結)
  if (fieldType === 'url') {
    const urlStr = String(val).trim()
    if (!urlStr) return <span style={{ color: '#cbd5e1' }}>—</span>
    const href = urlStr.startsWith('http://') || urlStr.startsWith('https://') ? urlStr : `https://${urlStr}`
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          color: '#ea580c',
          textDecoration: 'underline',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '220px',
        }}
      >
        <Link2 size={12} color="#ea580c" style={{ flexShrink: 0 }} />
        <span>{urlStr}</span>
      </a>
    )
  }

  // 10. Email (電子郵件)
  if (fieldType === 'email') {
    const emailStr = String(val).trim()
    if (!emailStr) return <span style={{ color: '#cbd5e1' }}>—</span>
    return (
      <a
        href={`mailto:${emailStr}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          color: '#ea580c',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '220px',
        }}
      >
        <Mail size={12} color="#ea580c" style={{ flexShrink: 0 }} />
        <span>{emailStr}</span>
      </a>
    )
  }

  // 11. Phone (電話)
  if (fieldType === 'phone') {
    return <span style={{ fontSize: '12px', color: '#0f172a' }}>📞 {String(val)}</span>
  }

  // 12. Date & Audit Dates (日期 / 建立時間 / 最後修改時間)
  if (fieldType === 'date' || fieldType === 'created_on' || fieldType === 'last_modified_on') {
    const dStr = formatDateValue(val)
    return (
      <span style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {fieldType === 'created_on' || fieldType === 'last_modified_on' ? <Clock size={11} color="#94a3b8" /> : null}
        <span>{dStr || String(val)}</span>
      </span>
    )
  }

  // 13. Audit Users (建立者 / 修改者)
  if (fieldType === 'created_by' || fieldType === 'last_modified_by') {
    const userLabel = typeof val === 'object' && val !== null ? val.username || val.name || String(val) : String(val)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#475569' }}>
        <User size={11} color="#64748b" />
        <span>{userLabel || '系統'}</span>
      </span>
    )
  }

  // 14. Formula / Lookup / Rollup
  if (fieldType === 'formula' || fieldType === 'lookup' || fieldType === 'rollup') {
    return renderFormulaCell(val)
  }

  // 15. AI Prompt
  if (fieldType === 'ai_prompt') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          color: '#4c1d95',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <Sparkles size={11} color="#ea580c" style={{ flexShrink: 0 }} />
        <span>{String(val)}</span>
      </span>
    )
  }

  // 16. Fallback & Smart JSON Unpacker (防代碼字串外露)
  let displayText = ''
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          displayText = parsed
            .map((item) =>
              typeof item === 'object' && item !== null
                ? item.value || item.name || item.username || item.title || (item.id ? `ID: ${item.id}` : '')
                : String(item)
            )
            .filter(Boolean)
            .join(', ')
        } else if (typeof parsed === 'object' && parsed !== null) {
          displayText =
            parsed.value ||
            parsed.name ||
            parsed.username ||
            parsed.title ||
            Object.values(parsed)
              .map((v) => String(v))
              .filter(Boolean)
              .join(', ')
        } else {
          displayText = String(parsed)
        }
      } catch {
        displayText = trimmed
      }
    } else {
      displayText = trimmed
    }
  } else if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      displayText = val
        .map((item) =>
          typeof item === 'object' && item !== null
            ? item.value || item.name || item.username || item.title || (item.id ? `ID: ${item.id}` : '')
            : String(item)
        )
        .filter(Boolean)
        .join(', ')
    } else {
      displayText =
        val.value ||
        val.name ||
        val.username ||
        val.title ||
        Object.values(val)
          .map((v) => String(v))
          .filter(Boolean)
          .join(', ')
    }
  } else {
    displayText = String(val)
  }

  return (
    <span
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '240px',
        display: 'inline-block',
        color: '#18181b',
      }}
      title={displayText}
    >
      {displayText || <span style={{ color: '#cbd5e1' }}>—</span>}
    </span>
  )
}

/**
 * Memoized single cell in MasterGridView.
 * Prevents re-rendering untouched cells when other cells or rows update.
 */
export const MasterGridCell: React.FC<MasterGridCellProps> = memo(
  ({
    row,
    fieldKey,
    rowIndex,
    unifiedColumnsMap,
    fieldsMap,
    isPinned,
    stickyLeft,
    isOverridden,
    originalVal,
    activeOverridePopover,
    revertingOverride,
    onToggleOverridePopover,
    onRevertOverride,
    onOpenDrawer,
  }) => {
    const isPopoverActive =
      activeOverridePopover?.tableId === row.tableId &&
      activeOverridePopover?.rowId === row.id &&
      activeOverridePopover?.key === fieldKey

    return (
      <td
        key={fieldKey}
        style={{
          padding: '10px 14px',
          color: '#18181b',
          borderLeft: '1px solid #f4f4f5',
          position: isPinned ? 'sticky' : 'relative',
          left: stickyLeft,
          zIndex: isPinned ? 5 : undefined,
          backgroundColor: isOverridden
            ? '#fffbeb'
            : isPinned
            ? rowIndex % 2 === 0
              ? '#f4f4f5'
              : '#e4e4e7'
            : 'transparent',
          boxShadow: isPinned ? '4px 0 6px -2px rgba(0, 0, 0, 0.04)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          {renderCellValueContent(row, fieldKey, unifiedColumnsMap, fieldsMap, onOpenDrawer)}
          {isOverridden && (
            <div style={{ position: 'relative' }}>
              <span
                data-testid="override-badge"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleOverridePopover(
                    isPopoverActive ? null : { tableId: row.tableId, rowId: row.id, key: fieldKey }
                  )
                }}
                title={`總表覆寫 (點擊查看與還原原始子表值: ${originalVal != null ? String(originalVal) : '無'})`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px 5px',
                  fontSize: '10px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  backgroundColor: row._isStaleOverride ? '#fef3c7' : '#fef9c3',
                  color: row._isStaleOverride ? '#b45309' : '#854d0e',
                  border: row._isStaleOverride ? '1px solid #fde68a' : '1px solid #fef08a',
                  cursor: 'pointer',
                }}
              >
                {row._isStaleOverride ? '覆寫 (來源已更新)' : '覆寫'}
              </span>

              {isPopoverActive && (
                <div
                  data-testid="override-popover"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    zIndex: 40,
                    width: '220px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    padding: '10px',
                    fontSize: '12px',
                    color: '#27272a',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: row._isStaleOverride ? '#b45309' : '#854d0e',
                    }}
                  >
                    {row._isStaleOverride ? '⚠️ 覆寫（來源資料已被更新）' : '總表專屬覆寫'}
                  </div>
                  {row._overrideUpdatedAt && (
                    <div style={{ fontSize: '10px', color: '#71717a', marginBottom: '4px' }}>
                      覆寫時間: {new Date(row._overrideUpdatedAt).toLocaleString()}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '8px' }}>
                    原始子表當前值: <strong>{originalVal != null ? String(originalVal) : '（空）'}</strong>
                  </div>
                  <button
                    data-testid="revert-override-btn"
                    onClick={() => onRevertOverride(row.tableId, row.id, fieldKey)}
                    disabled={revertingOverride}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '4px',
                      color: '#991b1b',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: revertingOverride ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RotateCcw size={11} className={revertingOverride ? 'animate-spin' : ''} />
                    {revertingOverride ? '還原中...' : '還原為原始值'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    )
  }
)

MasterGridCell.displayName = 'MasterGridCell'
