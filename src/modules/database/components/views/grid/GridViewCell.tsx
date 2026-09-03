import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Star, Search, Link2, Mail, Clock, Sparkles, AlertTriangle, ExternalLink, ArrowUpRight, MessageSquare, Send, Edit2, Trash2, Check, X, Paperclip } from 'lucide-react';
import { TableField } from '@/modules/database/types';
import { formatDateValue } from '@/modules/database/utils';
import { CardDrawer } from '@/modules/database/components/cards';
import ModalOverlay from '@/components/ui/ModalOverlay';
import PopoverPortal from '@/components/ui/PopoverPortal';
import { parseSelectItems, resolveChoiceString, getOptionColor, BASEROW_PALETTE, parseNumberInput, formatNumberValue } from './cells/utils';
import { LinkedRowCardChip } from './cells/LinkedRowCardChip';
export { parseNumberInput, formatNumberValue };

export interface CommentLogEntry {
  id: string
  user: string
  time: string
  content: string
}

export const parseLatestCommentEntries = (val: any): CommentLogEntry[] => {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

export const LatestCommentModal: React.FC<{
  show: boolean
  value: any
  fieldName?: string
  onChange: (newValue: CommentLogEntry[]) => void
  onClose: () => void
  readOnly?: boolean
}> = ({ show, value, fieldName = '最新留言紀錄', onChange, onClose, readOnly = false }) => {
  const entries = parseLatestCommentEntries(value)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!newText.trim() || readOnly) return
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false })
    const newEntry: CommentLogEntry = {
      id: 'lc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user: '使用者',
      time: nowStr,
      content: newText.trim()
    }
    const updated = [...entries, newEntry]
    onChange(updated)
    setNewText('')
  }

  const handleSaveEdit = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!editText.trim() || readOnly) return
    const updated = entries.map(item => item.id === id ? { ...item, content: editText.trim() } : item)
    onChange(updated)
    setEditingId(null)
    setEditText('')
  }

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (readOnly) return
    const updated = entries.filter(item => item.id !== id)
    onChange(updated)
  }

  return (
    <ModalOverlay
      show={show}
      onClose={onClose}
      className="animate-in fade-in duration-150"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      <div
        className="animate-in zoom-in-95 duration-150"
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '88vh',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFF7ED', border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{fieldName}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>檢視所有歷史備註留言與新增修訂紀錄</p>
            </div>
            <span style={{ fontSize: '11px', background: '#FFEDD5', color: '#C2410C', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, marginLeft: '6px' }}>
              {entries.length} 筆紀錄
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'background 0.15s ease' }}
            title="關閉"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '160px', background: '#f8fafc' }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={28} style={{ color: '#cbd5e1' }} />
              <span>尚無留言紀錄，請在下方輸入框新增第一筆備註。</span>
            </div>
          ) : (
            entries.map((item, idx) => {
              const isEditing = editingId === item.id
              const isLatest = idx === entries.length - 1
              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: isLatest ? '#FFF7ED' : '#ffffff',
                    border: isLatest ? '1px solid #FED7AA' : '1px solid #e2e8f0',
                    boxShadow: isLatest ? '0 2px 8px rgba(234, 88, 12, 0.06)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{item.user}</span>
                      {isLatest && (
                        <span style={{ fontSize: '10px', background: '#EA580C', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          最新紀錄
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.time}</span>
                      {!readOnly && !isEditing && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(item.id); setEditText(item.content); }}
                          title="更正此筆紀錄"
                          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569', padding: '3px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
                        >
                          <Edit2 size={12} /> 更正
                        </button>
                      )}
                      {!readOnly && !isEditing && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          title="刪除此筆紀錄"
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#ef4444', padding: '3px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
                        >
                          <Trash2 size={12} /> 刪除
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <textarea
                        rows={3}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '13px',
                          border: '1.5px solid #EA580C',
                          borderRadius: '6px',
                          resize: 'vertical',
                          outline: 'none',
                          boxShadow: '0 0 0 3px rgba(234, 88, 12, 0.12)',
                          lineHeight: '1.6',
                          background: '#ffffff'
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={(e) => handleSaveEdit(item.id, e)}
                          style={{ background: '#EA580C', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> 儲存更正
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#334155', wordBreak: 'break-word', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                      {item.content}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer: New Comment Input */}
        {!readOnly && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea
              rows={3}
              placeholder="輸入新留言備註 (長文字，支援多列輸入)..."
              value={newText}
              onChange={e => setNewText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                minHeight: '64px',
                background: '#ffffff',
                lineHeight: '1.6'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={(e) => handleAdd(e)}
                disabled={!newText.trim()}
                style={{
                  background: newText.trim() ? '#EA580C' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: newText.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: newText.trim() ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none'
                }}
              >
                <Send size={14} />
                <span>新增留言</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}







export function renderFormulaCell(value: any) {
  if (value === null || value === undefined || value === '') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', width: '100%', height: '100%', background: 'rgba(248, 250, 252, 0.4)' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace', opacity: 0.6 }}>ƒ</span>
      </div>
    );
  }

  const valStr = String(value);

  // 1. Formula Errors (#DIV/0!, #ERROR!, #NAME?, #CIRCULAR!, #VALUE!, #N/A)
  if (valStr.startsWith('#')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', width: '100%', height: '100%', background: 'rgba(254, 226, 226, 0.4)' }}>
        <span style={{
          fontSize: '11px',
          color: '#b91c1c',
          background: '#fee2e2',
          padding: '2px 6px',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <AlertTriangle size={12} color="#dc2626" /> {valStr}
        </span>
      </div>
    );
  }

  // 2. Boolean values
  if (value === true || value === false || valStr === 'true' || valStr === 'false') {
    const isTrue = value === true || valStr === 'true';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', width: '100%', height: '100%', background: 'rgba(248, 250, 252, 0.4)' }}>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, opacity: 0.7 }}>ƒ</span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: isTrue ? '#15803d' : '#475569',
          background: isTrue ? '#dcfce7' : '#f1f5f9',
          border: isTrue ? '1px solid #86efac' : '1px solid #cbd5e1',
          padding: '1px 8px',
          borderRadius: '12px'
        }}>
          {isTrue ? '✓ True' : '✗ False'}
        </span>
      </div>
    );
  }

  // 3. Numeric values
  const num = Number(value);
  const isNumeric = !isNaN(num) && typeof value !== 'boolean' && valStr.trim() !== '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isNumeric ? 'flex-end' : 'flex-start', gap: '6px', padding: '0 8px', overflow: 'hidden', width: '100%', height: '100%', background: 'rgba(248, 250, 252, 0.4)' }}>
      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, flexShrink: 0, opacity: 0.7 }}>ƒ</span>
      <span style={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '13px',
        color: '#1e293b',
        fontWeight: isNumeric ? 600 : 400,
        fontFamily: isNumeric ? 'monospace' : 'inherit'
      }}>
        {isNumeric ? num.toLocaleString() : valStr}
      </span>
    </div>
  );
}

interface GridViewCellProps {
  rowId: number;
  field: TableField;
  value: any;
  isSelected: boolean;
  isEditing: boolean;
  isInRange?: boolean;
  isInAutofillRange?: boolean;
  isRowSelected?: boolean;
  isRowHovered?: boolean;
  rangeEdges?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  isPrimary?: boolean;
  rowColorBg?: string | null;
  rowDetailsWidth?: number;
  initialTypeOverValue?: string | null;
  onSelect: (e?: React.MouseEvent) => void;
  onMouseEnterCell?: () => void;
  onStartAutofill?: (e: React.MouseEvent) => void;
  onAutoFillDown?: () => void;
  onStartEdit: (initialVal?: string) => void;
  onUpdate: (val: any) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onCancelEdit: () => void;
  onNavigateCell?: (direction: 'nextRow' | 'prevRow' | 'nextCol' | 'prevCol') => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const GridViewCell: React.FC<GridViewCellProps> = ({
  rowId,
  field,
  value,
  isSelected,
  isEditing,
  isInRange,
  isInAutofillRange = false,
  isRowSelected,
  isRowHovered,
  rangeEdges,
  isPrimary = false,
  rowColorBg,
  rowDetailsWidth = 56,
  initialTypeOverValue,
  onSelect,
  onMouseEnterCell,
  onStartAutofill,
  onAutoFillDown,
  onStartEdit,
  onUpdate,
  onUpdateField,
  onCancelEdit,
  onNavigateCell,
  onContextMenu,
}) => {
  const getInitialStringValue = (val: any, type: string): string => {
    if (val === null || val === undefined) return type === 'multiple_select' ? '[]' : '';
    if (type === 'boolean') return String(val);
    if (type === 'date') return formatDateValue(val);
    if (type === 'multiple_select') {
      const items = parseSelectItems(val, field.options);
      return JSON.stringify(items);
    }
    const items = parseSelectItems(val, field.options);
    if (items.length > 0) return items.join(', ');
    return String(val);
  };

  const cleanChoice = (item: any): string[] => {
    if (item === null || item === undefined || item === '') return [];
    if (typeof item === 'object') {
      if (Array.isArray(item.choices)) return item.choices.flatMap(cleanChoice);
      const label = item.name ?? item.label ?? item.text ?? item.value ?? item.id;
      if (label !== undefined && label !== null) return [String(label)];
      return [String(item)];
    }
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"{\\') || trimmed.startsWith('"{')) {
        try {
          let parsed = JSON.parse(trimmed);
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch {}
          }
          return cleanChoice(parsed);
        } catch {}
      }
      return [trimmed];
    }
    return [String(item)];
  };

  const getFieldChoiceObjects = (): Array<{ id: string; name: string; color?: string }> => {
    if (!field.options) return [];
    let rawItems: any[] = [];
    let opts: any = field.options;
    if (typeof opts === 'string') {
      try {
        let parsed = JSON.parse(opts);
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        opts = parsed;
      } catch {}
    }
    if (Array.isArray(opts)) {
      rawItems = opts;
    } else if (opts && typeof opts === 'object') {
      if (Array.isArray(opts.choices)) rawItems = opts.choices;
      else if (Array.isArray(opts.select_options)) rawItems = opts.select_options;
      else if (Array.isArray(opts.options)) rawItems = opts.options;
      else if (Array.isArray(opts.selectOptions)) rawItems = opts.selectOptions;
    }

    if (rawItems.length === 0 && typeof field.options === 'string' && field.options.trim() && !field.options.startsWith('{')) {
      rawItems = field.options.split(',');
    }
    const isUuidPattern = (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
      /^[0-9a-f]{24,}$/i.test(s.trim());

    return rawItems
      .map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          const id = String(item.id ?? `opt_${idx}`);
          const name = String(item.name ?? item.label ?? item.text ?? item.value ?? item.id ?? '').trim();
          const color = item.color;
          return { id, name, color };
        }
        const str = String(item || '').trim();
        return { id: `opt_${idx}`, name: str };
      })
      .filter(opt => opt.name && !isUuidPattern(opt.name));
  };

  const getFieldOptions = (): string[] => {
    const choiceObjs = getFieldChoiceObjects();
    const names = choiceObjs.map(c => c.name);
    return Array.from(new Set(names));
  };

  const [localVal, setLocalVal] = useState<any>(
    initialTypeOverValue !== undefined && initialTypeOverValue !== null
      ? initialTypeOverValue
      : getInitialStringValue(value, field.type)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const localValRef = useRef(localVal);
  const hasCommittedRef = useRef(false);
  const longTextDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [selectActiveIndex, setSelectActiveIndex] = useState<number>(0);

  useEffect(() => {
    if (isEditing) {
      if (initialTypeOverValue !== undefined && initialTypeOverValue !== null) {
        setLocalVal(initialTypeOverValue);
      }
    } else {
      setLocalVal(getInitialStringValue(value, field.type));
    }
  }, [value, field.type, isEditing, initialTypeOverValue]);

  useEffect(() => {
    localValRef.current = localVal;
  }, [localVal]);

  useEffect(() => {
    if (isEditing) {
      hasCommittedRef.current = false;
      setSelectActiveIndex(0);
    }
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (longTextDebounceRef.current) {
        clearTimeout(longTextDebounceRef.current);
        longTextDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (initialTypeOverValue !== undefined && initialTypeOverValue !== null) {
            const len = String(initialTypeOverValue).length;
            try {
              inputRef.current.setSelectionRange(len, len);
            } catch {}
          } else if (typeof (inputRef.current as any).select === 'function' && field.type !== 'single_select' && field.type !== 'multiple_select') {
            (inputRef.current as any).select();
          }
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isEditing, field.type, initialTypeOverValue]);

  const handleBlur = () => {
    onUpdate(localVal);
  };

  const wasEditingRef = useRef(isEditing);
  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      if (!hasCommittedRef.current && 
          ['text', 'number', 'date', 'email', 'url', 'phone', 'phone_number'].includes(field.type)) {
        hasCommittedRef.current = true;
        if (field.type === 'number') {
          onUpdate(parseNumberInput(localValRef.current));
        } else {
          onUpdate(localValRef.current);
        }
      }
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, field.type, onUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onUpdate(localVal);
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  // Hover state for showing + button on empty link_row cells
  const [isCellHovered, setIsCellHovered] = useState(false);
  const [isLongTextExpanded, setIsLongTextExpanded] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const longTextRef = useRef<HTMLTextAreaElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);

  useEffect(() => {
    if (!cellRef.current) return;
    setMeasuredWidth(cellRef.current.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setMeasuredWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(cellRef.current);
    return () => observer.disconnect();
  }, []);

  const calculateDynamicVisibleCount = (itemStrings: string[], width: number): { visibleCount: number; hiddenCount: number } => {
    if (!itemStrings || itemStrings.length === 0) return { visibleCount: 0, hiddenCount: 0 };

    const containerW = width > 0 ? width - 16 : 200;
    let currentWidth = 0;
    let visibleCount = 0;

    for (let i = 0; i < itemStrings.length; i++) {
      const str = String(itemStrings[i] || '');
      const tagWidth = Math.max(32, str.length * 8 + 30);
      const badgeWidth = (i < itemStrings.length - 1) ? 36 : 0;

      if (currentWidth + tagWidth + badgeWidth <= containerW) {
        currentWidth += tagWidth + 4;
        visibleCount++;
      } else {
        break;
      }
    }

    visibleCount = Math.max(1, visibleCount);

    if (visibleCount >= itemStrings.length) {
      return { visibleCount: itemStrings.length, hiddenCount: 0 };
    }

    return {
      visibleCount,
      hiddenCount: itemStrings.length - visibleCount
    };
  };

  useEffect(() => {
    if (isEditing && cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      if (field.type === 'long_text') {
        const editorW = Math.max(400, rect.width);
        const editorH = 200;
        let top = rect.top;
        let left = rect.left;
        if (top + editorH > viewportH - 16) top = Math.max(8, viewportH - editorH - 16);
        if (left + editorW > viewportW - 16) left = Math.max(8, viewportW - editorW - 16);
        setPopoverPos({ top, left, width: editorW });
      } else if (field.type === 'single_select' || field.type === 'multiple_select') {
        const editorW = Math.max(220, rect.width);
        const editorH = 260;
        let top = rect.bottom + 2;
        let left = rect.left;
        if (top + editorH > viewportH - 16) top = Math.max(8, rect.top - editorH - 4);
        if (left + editorW > viewportW - 16) left = Math.max(8, viewportW - editorW - 16);
        setPopoverPos({ top, left, width: editorW });
      } else if (field.type === 'latest_comment') {
        const editorW = 360;
        const editorH = 380;
        let top = rect.bottom + 2;
        let left = rect.left;
        if (top + editorH > viewportH - 16) top = Math.max(8, rect.top - editorH - 4);
        if (left + editorW > viewportW - 16) left = Math.max(8, viewportW - editorW - 16);
        setPopoverPos({ top, left, width: editorW });
      }
    }
    if (!isEditing) {
      setIsLongTextExpanded(false);
      setComboSearch('');
      setPopoverPos(null);
    }
  }, [isEditing, field.type]);

  // Auto-focus long_text textarea with cursor at end
  useEffect(() => {
    if (isEditing && field.type === 'long_text' && longTextRef.current) {
      const ta = longTextRef.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [isEditing, field.type, isLongTextExpanded]);

  const handleLongTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts a tab character instead of moving focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const nextVal = val.substring(0, start) + '\t' + val.substring(end);
      setLocalVal(nextVal);
      onUpdate(nextVal);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 1, start + 1);
      });
    }
    // Escape closes editor
    if (e.key === 'Escape') {
      onUpdate(localVal);
      setIsLongTextExpanded(false);
      onCancelEdit();
    }
    // Stop propagation so grid-level keyboard handlers don't interfere
    e.stopPropagation();
  }, [localVal, onUpdate, onCancelEdit]);

  // link_row relation modal state when cell is editing
  const [relationSearch, setRelationSearch] = useState('');
  const [relationRows, setRelationRows] = useState<any[]>([]);
  const [targetFields, setTargetFields] = useState<TableField[]>([]);
  const [relationLoading, setRelationLoading] = useState(false);

  // Detail drawer state for inspecting linked target rows
  const [activeDetailRowId, setActiveDetailRowId] = useState<number | null>(null);

  const openRowDetail = (rowId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!targetTableId) return;
    setActiveDetailRowId(rowId);
  };


  const fieldOptions = React.useMemo(() => {
    if (!field.options) return {};
    try {
      return typeof field.options === 'string' ? JSON.parse(field.options) : field.options;
    } catch {
      return {};
    }
  }, [field.options]);

  const targetTableId = fieldOptions?.targetTableId;


  // Fetch target table fields & rows when link_row cell starts editing
  useEffect(() => {
    if (isEditing && field.type === 'link_row' && targetTableId) {
      setRelationLoading(true);
      fetch(`/api/tables/${targetTableId}/fields`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            data.sort((a, b) => (a.order || 0) - (b.order || 0));
            setTargetFields(data);
          }
        })
        .catch(console.error);

      fetch(`/api/tables/${targetTableId}/rows?page=1&pageSize=30`)
        .then(res => res.json())
        .then(data => {
          const rowsArray = Array.isArray(data) ? data : (data.rows || []);
          setRelationRows(rowsArray);
        })
        .catch(console.error)
        .finally(() => setRelationLoading(false));
    }
  }, [isEditing, field.type, targetTableId]);

  // Temporary selected items state while Modal is open
  const [tempSelectedItems, setTempSelectedItems] = useState<Array<{ id: number; value: string }>>([]);

  // Initialize tempSelectedItems when editing starts
  useEffect(() => {
    if (isEditing && field.type === 'link_row') {
      let rawList: any[] = [];
      if (Array.isArray(value)) {
        rawList = value;
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) rawList = parsed;
        } catch {}
      }

      const initialItems = rawList.flatMap(item => {
        if (typeof item === 'object' && item !== null && 'id' in item) {
          const numId = Number((item as any).id);
          if (isNaN(numId)) return [];
          return [{ id: numId, value: String((item as any).value || `列 ID: ${numId}`) }];
        }
        const numId = Number(item);
        if (!isNaN(numId)) {
          return [{ id: numId, value: `列 ID: ${numId}` }];
        }
        return [];
      });

      setTempSelectedItems(initialItems);
    }
  }, [isEditing, field.type, value]);

  // Debounced search when relationSearch changes while editing
  useEffect(() => {
    if (isEditing && field.type === 'link_row' && targetTableId) {
      const timer = setTimeout(() => {
        setRelationLoading(true);
        const url = relationSearch.trim()
          ? `/api/tables/${targetTableId}/rows?search=${encodeURIComponent(relationSearch.trim())}&page=1&pageSize=30`
          : `/api/tables/${targetTableId}/rows?page=1&pageSize=30`;
        fetch(url)
          .then(res => res.json())
          .then(data => setRelationRows(Array.isArray(data) ? data : (data.rows || [])))
          .catch(console.error)
          .finally(() => setRelationLoading(false));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [relationSearch, isEditing, field.type, targetTableId]);

  // State for Combobox (single/multi select)
  const [comboSearch, setComboSearch] = useState('');

  const renderCellContent = () => {
    if (isEditing) {
      if (field.type === 'link_row') {
        const parseCurrentItems = (): Array<{ id: number; value: string }> => {
          let rawList: any[] = [];
          if (Array.isArray(value)) {
            rawList = value;
          } else if (typeof value === 'string' && value.trim()) {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) rawList = parsed;
            } catch {}
          }

          const primaryField = targetFields[0];
          const primaryKey = primaryField ? `field_${primaryField.id}` : null;

          return rawList.flatMap(item => {
            if (typeof item === 'object' && item !== null && 'id' in item) {
              const numId = Number((item as any).id);
              if (isNaN(numId)) return [];
              let label = String((item as any).value || '');
              if (!label || label.startsWith('列 ID:')) {
                const rRow = relationRows.find(r => r.id === numId);
                if (rRow && primaryKey && rRow.data?.[primaryKey]) {
                  label = String(rRow.data[primaryKey]);
                }
              }
              return [{ id: numId, value: label || `列 ID: ${numId}` }];
            }
            const numId = Number(item);
            if (isNaN(numId)) return [];
            let label = '';
            const rRow = relationRows.find(r => r.id === numId);
            if (rRow && primaryKey && rRow.data?.[primaryKey]) {
              label = String(rRow.data[primaryKey]);
            }
            return [{ id: numId, value: label || `列 ID: ${numId}` }];
          });
        };

        const allowMultiple = fieldOptions?.allowMultiple !== false;
        const currentIds = tempSelectedItems.map(i => i.id);

        const toggleRowSelection = (targetRow: any) => {
          const targetId = targetRow.id;
          const isLinked = currentIds.includes(targetId);
          if (isLinked) {
            setTempSelectedItems(prev => prev.filter(i => i.id !== targetId));
          } else {
            const primaryField = targetFields[0];
            const primaryKey = primaryField ? `field_${primaryField.id}` : Object.keys(targetRow.data || {})[0];
            const primaryVal = String(targetRow.data?.[primaryKey] ?? `列 ID: ${targetId}`);
            if (allowMultiple) {
              setTempSelectedItems(prev => [...prev, { id: targetId, value: primaryVal }]);
            } else {
              setTempSelectedItems([{ id: targetId, value: primaryVal }]);
            }
          }
        };

        const handleCreateNewRow = async () => {
          if (!targetTableId) return;
          try {
            setRelationLoading(true);
            const primaryField = targetFields[0];
            const initialData: Record<string, any> = {};
            if (primaryField && relationSearch.trim()) {
              initialData[`field_${primaryField.id}`] = relationSearch.trim();
            }
            const res = await fetch(`/api/tables/${targetTableId}/rows`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: initialData }),
            });
            if (!res.ok) throw new Error('新增列失敗');
            const newRow = await res.json();

            setRelationRows(prev => [newRow, ...prev]);
            const primaryKey = primaryField ? `field_${primaryField.id}` : Object.keys(newRow.data || {})[0];
            const primaryVal = String(newRow.data?.[primaryKey] || relationSearch.trim() || `列 ID: ${newRow.id}`);

            if (allowMultiple) {
              setTempSelectedItems(prev => [...prev, { id: newRow.id, value: primaryVal }]);
            } else {
              setTempSelectedItems([{ id: newRow.id, value: primaryVal }]);
            }
          } catch (err) {
            console.error('[Create New Row Error]:', err);
          } finally {
            setRelationLoading(false);
          }
        };

        const handleConfirmRelation = () => {
          onUpdate(tempSelectedItems);
          onCancelEdit();
        };

        return (
          <ModalOverlay
            show={true}
            onClose={handleConfirmRelation}
            zIndex={99999}
            blur={false}
            lockScroll={false}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          >
            <div
              style={{
                width: '780px',
                maxWidth: '92vw',
                height: '560px',
                maxHeight: '85vh',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '420px' }}>
                  <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search rows (支援全欄位比對)..."
                    value={relationSearch}
                    onChange={e => setRelationSearch(e.target.value)}
                    style={{ flex: 1, padding: '6px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewRow}
                    style={{
                      padding: '6px 12px',
                      background: '#18181B',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ＋ 新增列
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    已選擇 {currentIds.length} 項{!allowMultiple && ' (單選)'}
                  </span>
                  <button
                    onClick={() => handleConfirmRelation()}
                    style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    ✕ 完成關閉
                  </button>
                </div>
              </div>


              {/* Table Grid View Body */}
              <div style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
                {relationLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
                    載入關聯表格資料中...
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ width: '44px', padding: '10px 12px', textAlign: 'center' }}>選取</th>
                        {targetFields.map(f => (
                          <th key={f.id} style={{ padding: '10px 12px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {relationRows.length === 0 ? (
                        <tr>
                          <td colSpan={targetFields.length + 1} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                            找不到符合條件的關聯列
                          </td>
                        </tr>
                      ) : (
                        relationRows.map(r => {
                          const isLinked = currentIds.includes(r.id);
                          return (
                            <tr
                              key={r.id}
                              onClick={() => toggleRowSelection(r)}
                              style={{
                                borderBottom: '1px solid #e2e8f0',
                                background: isLinked ? '#f0fdf4' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                            >
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  onChange={() => {}}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </td>
                              {targetFields.map(f => {
                                const fKey = `field_${f.id}`;
                                const cellVal = r.data?.[fKey];
                                let displayCell = '';
                                if (cellVal != null && cellVal !== '') {
                                  if (typeof cellVal === 'boolean') {
                                    displayCell = cellVal ? '✓' : '';
                                  } else if (Array.isArray(cellVal)) {
                                    displayCell = cellVal
                                      .map(item => (typeof item === 'object' && item !== null ? item.value || item.name || item.id : String(item)))
                                      .filter(Boolean)
                                      .join(', ');
                                  } else if (typeof cellVal === 'object') {
                                    displayCell = String(cellVal.value || cellVal.name || cellVal.id || '');
                                  } else {
                                    displayCell = String(cellVal);
                                  }
                                }
                                return (
                                  <td key={f.id} style={{ padding: '10px 12px', color: '#1e293b', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                    {displayCell}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <button
                  onClick={() => handleConfirmRelation()}
                  style={{ padding: '6px 16px', background: '#18181B', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  確認
                </button>
              </div>
            </div>
          </ModalOverlay>
        );
      }

      if (field.type === 'boolean') {
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', boxShadow: 'inset 0 0 0 2px #3F6212', zIndex: 10 }}>
            <input
              type="checkbox"
              checked={localVal === 'true' || localVal === '1' || localVal === 'yes'}
              onChange={(e) => {
                const checked = e.target.checked ? 'true' : 'false';
                setLocalVal(checked);
                onUpdate(checked);
              }}
              className="w-4 h-4 text-[#3F6212] rounded border-slate-300 focus:ring-[#3F6212]"
            />
          </div>
        );
      }

      if (field.type === 'single_select') {
        const choiceObjs = getFieldChoiceObjects();
        const options = choiceObjs.map(c => c.name);
        const filteredOptions = options.filter(opt => opt.toLowerCase().includes(comboSearch.toLowerCase()));
        const isExactMatch = options.some(opt => opt.toLowerCase() === comboSearch.toLowerCase());

        return (
          <>
            <div 
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancelEdit();
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                background: '#fff', boxShadow: 'inset 0 0 0 2px #3F6212', 
                zIndex: 9999, display: 'flex', outline: 'none', boxSizing: 'border-box',
                alignItems: 'center', padding: '0 8px'
              }}
            >
              {localVal ? (
                <span style={{ ...getOptionColor(localVal, choiceObjs), padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {localVal}
                </span>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>請選擇...</span>
              )}
              <div style={{ marginLeft: 'auto', color: '#64748b' }}>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <PopoverPortal
              show={true}
              onClose={() => {
                onUpdate(localVal);
                onCancelEdit();
              }}
              position={popoverPos}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)', 
                borderRadius: '8px',
                maxHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      ref={inputRef as any}
                      autoFocus
                      type="text"
                      value={comboSearch}
                      onChange={(e) => {
                        setComboSearch(e.target.value);
                        setSelectActiveIndex(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          onCancelEdit();
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const maxIdx = filteredOptions.length - 1 + (comboSearch && !isExactMatch ? 1 : 0);
                          setSelectActiveIndex(prev => Math.min(prev + 1, Math.max(0, maxIdx)));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectActiveIndex(prev => Math.max(0, prev - 1));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (selectActiveIndex >= 0 && selectActiveIndex < filteredOptions.length) {
                            const opt = filteredOptions[selectActiveIndex];
                            setLocalVal(opt);
                            onUpdate(opt);
                            onCancelEdit();
                            return;
                          }
                          if (selectActiveIndex === filteredOptions.length && comboSearch && !isExactMatch) {
                            const valToCreate = comboSearch.trim();
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valToCreate) || /^[0-9a-f]{24,}$/i.test(valToCreate);
                            if (!isUuid && onUpdateField) {
                              const newId = 'opt_' + Math.random().toString(36).substr(2, 9);
                              const newColor = BASEROW_PALETTE[choiceObjs.length % BASEROW_PALETTE.length].bg;
                              const newChoiceObjs = [...choiceObjs, { id: newId, name: valToCreate, color: newColor }];
                              onUpdateField(field.id, { options: { choices: newChoiceObjs } as any });
                            }
                            setLocalVal(valToCreate);
                            onUpdate(valToCreate);
                            onCancelEdit();
                            return;
                          }
                          if (comboSearch.trim()) {
                            const val = comboSearch.trim();
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^[0-9a-f]{24,}$/i.test(val);
                            if (!isExactMatch && !isUuid && onUpdateField) {
                              const newId = 'opt_' + Math.random().toString(36).substr(2, 9);
                              const newColor = BASEROW_PALETTE[choiceObjs.length % BASEROW_PALETTE.length].bg;
                              const newChoiceObjs = [...choiceObjs, { id: newId, name: val, color: newColor }];
                              onUpdateField(field.id, { options: { choices: newChoiceObjs } as any });
                            }
                            setLocalVal(val);
                            onUpdate(val);
                            onCancelEdit();
                          }
                        }
                      }}
                      placeholder="搜尋或輸入新增 (↑↓ 選擇，Enter 確認)..."
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', marginLeft: '8px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ overflowY: 'auto', padding: '4px 0', flex: 1 }}>
                    {filteredOptions.map((opt, i) => {
                      const { bg, text } = getOptionColor(opt, choiceObjs);
                      const isSelected = localVal === opt;
                      const isHighlighted = selectActiveIndex === i;
                      return (
                        <div 
                          key={i} 
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLocalVal(opt);
                            onUpdate(opt);
                            onCancelEdit();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLocalVal(opt);
                            onUpdate(opt);
                            onCancelEdit();
                          }}
                          style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            background: isSelected ? '#f1f5f9' : (isHighlighted ? '#f8fafc' : 'transparent'),
                            borderLeft: isHighlighted ? '3px solid #3F6212' : '3px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.1s ease',
                          }}
                          onMouseEnter={() => { setSelectActiveIndex(i); }}
                        >
                          <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: isSelected ? 600 : 400 }}>
                            {opt}
                          </span>
                        </div>
                      );
                    })}
                    {comboSearch && !isExactMatch && (
                      <div 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const valToCreate = comboSearch.trim();
                          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valToCreate) || /^[0-9a-f]{24,}$/i.test(valToCreate);
                          if (!isUuid && onUpdateField) {
                            const newId = 'opt_' + Math.random().toString(36).substr(2, 9);
                            const newColor = BASEROW_PALETTE[choiceObjs.length % BASEROW_PALETTE.length].bg;
                            const newChoiceObjs = [...choiceObjs, { id: newId, name: valToCreate, color: newColor }];
                            onUpdateField(field.id, { options: { choices: newChoiceObjs } as any });
                          }
                          setLocalVal(valToCreate);
                          onUpdate(valToCreate);
                          onCancelEdit();
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          color: '#18181B',
                          fontWeight: 500,
                          background: selectActiveIndex === filteredOptions.length ? '#e2e8f0' : '#F4F4F5',
                          borderLeft: selectActiveIndex === filteredOptions.length ? '3px solid #3F6212' : '3px solid transparent',
                        }}
                        onMouseEnter={() => setSelectActiveIndex(filteredOptions.length)}
                      >
                        + 建立 "{comboSearch}"
                      </div>
                    )}
                    {filteredOptions.length === 0 && !comboSearch && (
                      <div style={{ padding: '12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>尚無選項，請直接輸入搜尋建立</div>
                    )}
                  </div>
            </PopoverPortal>
          </>
        );
      }

      if (field.type === 'multiple_select') {
        const choiceObjs = getFieldChoiceObjects();
        const options = choiceObjs.map(c => c.name);
        let currentItems: string[] = [];
        try { currentItems = JSON.parse(localVal); if (!Array.isArray(currentItems)) currentItems = [String(localVal)]; } 
        catch { currentItems = String(localVal ?? '').split(',').map((s: string) => s.trim()).filter(Boolean); }
        
        const filteredOptions = options.filter(opt => opt.toLowerCase().includes(comboSearch.toLowerCase()));
        const isExactMatch = options.some(opt => opt.toLowerCase() === comboSearch.toLowerCase());
        const searchAlreadySelected = currentItems.some(item => item.toLowerCase() === comboSearch.toLowerCase());

        return (
          <>
            <div 
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancelEdit();
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', minHeight: '100%', 
                background: '#fff', boxShadow: 'inset 0 0 0 2px #3F6212', 
                zIndex: 9999, display: 'flex', outline: 'none', boxSizing: 'border-box',
                flexWrap: 'wrap', gap: '4px', padding: '4px 8px', alignItems: 'center'
              }}
            >
              {currentItems.map((item, i) => {
                const { bg, text } = getOptionColor(item, choiceObjs);
                return (
                  <span key={i} style={{ background: bg, color: text, padding: '2px 6px', borderRadius: '9999px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                    {item}
                    <span 
                      onClick={() => {
                        const nextItems = currentItems.filter(v => v !== item);
                        const nextVal = JSON.stringify(nextItems);
                        setLocalVal(nextVal);
                        onUpdate(nextVal);
                      }}
                      style={{ marginLeft: '4px', cursor: 'pointer', opacity: 0.6 }}
                    >×</span>
                  </span>
                );
              })}
              
              <div style={{ marginLeft: 'auto', color: '#64748b' }}>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <PopoverPortal
              show={true}
              onClose={() => {
                onUpdate(localVal);
                onCancelEdit();
              }}
              position={popoverPos}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)', 
                borderRadius: '8px',
                maxHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      ref={inputRef as any}
                      autoFocus
                      type="text"
                      value={comboSearch}
                      onChange={(e) => {
                        setComboSearch(e.target.value);
                        setSelectActiveIndex(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          onCancelEdit();
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const maxIdx = filteredOptions.length - 1 + (comboSearch && !isExactMatch ? 1 : 0);
                          setSelectActiveIndex(prev => Math.min(prev + 1, Math.max(0, maxIdx)));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectActiveIndex(prev => Math.max(0, prev - 1));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (selectActiveIndex >= 0 && selectActiveIndex < filteredOptions.length) {
                            const opt = filteredOptions[selectActiveIndex];
                            let nextItems = [...currentItems];
                            if (nextItems.includes(opt)) {
                              nextItems = nextItems.filter(v => v !== opt);
                            } else {
                              nextItems.push(opt);
                            }
                            const nextVal = JSON.stringify(nextItems);
                            setLocalVal(nextVal);
                            onUpdate(nextVal);
                            setComboSearch('');
                            return;
                          }
                          if (selectActiveIndex === filteredOptions.length && comboSearch && !isExactMatch) {
                            const val = comboSearch.trim();
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^[0-9a-f]{24,}$/i.test(val);
                            if (!isUuid && onUpdateField) {
                              const newId = 'opt_' + Math.random().toString(36).substr(2, 9);
                              const newColor = BASEROW_PALETTE[choiceObjs.length % BASEROW_PALETTE.length].bg;
                              const newChoiceObjs = [...choiceObjs, { id: newId, name: val, color: newColor }];
                              onUpdateField(field.id, { options: { choices: newChoiceObjs } as any });
                            }
                            let nextItems = [...currentItems];
                            if (!nextItems.some(item => item.toLowerCase() === val.toLowerCase())) {
                              nextItems.push(val);
                            }
                            const nextVal = JSON.stringify(nextItems);
                            setLocalVal(nextVal);
                            onUpdate(nextVal);
                            setComboSearch('');
                            return;
                          }
                          if (comboSearch.trim()) {
                            const val = comboSearch.trim();
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^[0-9a-f]{24,}$/i.test(val);
                            if (!isExactMatch && !isUuid && onUpdateField) {
                              const newId = 'opt_' + Math.random().toString(36).substr(2, 9);
                              const newColor = BASEROW_PALETTE[choiceObjs.length % BASEROW_PALETTE.length].bg;
                              const newChoiceObjs = [...choiceObjs, { id: newId, name: val, color: newColor }];
                              onUpdateField(field.id, { options: { choices: newChoiceObjs } as any });
                            }
                            let nextItems = [...currentItems];
                            if (!nextItems.some(item => item.toLowerCase() === val.toLowerCase())) {
                              nextItems.push(val);
                            }
                            const nextVal = JSON.stringify(nextItems);
                            setLocalVal(nextVal);
                            onUpdate(nextVal);
                            setComboSearch('');
                          }
                        }
                      }}
                      placeholder="搜尋或輸入新增 (↑↓ 選擇，Enter 切換)..."
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', marginLeft: '8px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ overflowY: 'auto', padding: '4px 0', flex: 1 }}>
                    {filteredOptions.map((opt, i) => {
                      const isSelected = currentItems.includes(opt);
                      const isHighlighted = selectActiveIndex === i;
                      const { bg, text } = getOptionColor(opt, choiceObjs);
                      return (
                        <div 
                          key={i} 
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            let nextItems = [...currentItems];
                            if (!isSelected) nextItems.push(opt);
                            else nextItems = nextItems.filter(item => item !== opt);
                            const nextVal = JSON.stringify(nextItems);
                            setLocalVal(nextVal);
                            onUpdate(nextVal);
                          }}
                          style={{ 
                            padding: '6px 12px', cursor: 'pointer', 
                            background: isSelected ? '#f1f5f9' : (isHighlighted ? '#f8fafc' : 'transparent'),
                            borderLeft: isHighlighted ? '3px solid #3F6212' : '3px solid transparent',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'all 0.1s ease',
                          }}
                          onMouseEnter={() => setSelectActiveIndex(i)}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div click
                            style={{ margin: 0, cursor: 'pointer', pointerEvents: 'none', accentColor: '#3F6212' }}
                          />
                          <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: isSelected ? 600 : 400 }}>
                            {opt}
                          </span>
                        </div>
                      );
                    })}
                    {comboSearch && !isExactMatch && !searchAlreadySelected && (
                      <div 
                        onTouchStart={(e) => e.stopPropagation()}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const valToAdd = comboSearch.trim();
                          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valToAdd) || /^[0-9a-f]{24,}$/i.test(valToAdd);
                          if (!isUuid && onUpdateField) {
                            const newId = 'opt_' + Math.random().toString(36).substr(2, 9);
                            const newColor = BASEROW_PALETTE[choiceObjs.length % BASEROW_PALETTE.length].bg;
                            const newChoiceObjs = [...choiceObjs, { id: newId, name: valToAdd, color: newColor }];
                            onUpdateField(field.id, { options: { choices: newChoiceObjs } as any });
                          }
                          const nextItems = [...currentItems, valToAdd];
                          const nextVal = JSON.stringify(nextItems);
                          setLocalVal(nextVal);
                          onUpdate(nextVal);
                          setComboSearch('');
                        }}
                        style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', color: '#18181B', fontWeight: 500, background: '#F4F4F5' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F4F4F5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#F4F4F5'}
                      >
                        + 建立 "{comboSearch}"
                      </div>
                    )}
                    {filteredOptions.length === 0 && !comboSearch && (
                      <div style={{ padding: '12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>尚無選項，請直接輸入搜尋建立</div>
                    )}
                  </div>
            </PopoverPortal>
          </>
        );
      }

      if (field.type === 'long_text') {
        const textVal = String(localVal ?? '');
        const charCount = textVal.length;
        const wordCount = textVal.trim() ? textVal.trim().split(/\s+/).length : 0;

        if (isLongTextExpanded) {
          // Fullscreen modal overlay
          return (
            <ModalOverlay
              show={true}
              onClose={() => {
                onUpdate(localVal);
                setIsLongTextExpanded(false);
                onCancelEdit();
              }}
              zIndex={999998}
              blur={false}
              style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            >
              <div
                style={{
                  width: 'min(720px, 90vw)',
                  height: 'min(520px, 80vh)',
                  background: '#fff',
                  borderRadius: '10px',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{field.name}</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => setIsLongTextExpanded(false)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', border: '1px solid #cbd5e1', borderRadius: '6px',
                        background: '#fff', cursor: 'pointer', color: '#475569',
                      }}
                      title="縮小"
                    >
                      <Minimize2 size={14} />
                    </button>
                  </div>
                </div>
                {/* Textarea body */}
                <textarea
                  ref={longTextRef}
                  value={localVal}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocalVal(v);
                    if (longTextDebounceRef.current) clearTimeout(longTextDebounceRef.current);
                    longTextDebounceRef.current = setTimeout(() => {
                      onUpdate(v);
                    }, 400);
                  }}
                  onKeyDown={handleLongTextKeyDown}
                  style={{
                    flex: 1,
                    padding: '14px 18px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: '#0f172a',
                    lineHeight: 1.6,
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    background: '#fff',
                  }}
                  placeholder="輸入多行文字..."
                />
                {/* Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 16px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {charCount} 字元 · {wordCount} 詞
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>自動儲存</span>
                </div>
              </div>
            </ModalOverlay>
          );
        }

        // Inline expanded editor (portal over cell)
        return (
          <PopoverPortal
            show={true}
            onClose={() => {
              onUpdate(localVal);
              onCancelEdit();
            }}
            position={popoverPos}
            style={{
              width: popoverPos ? popoverPos.width : Math.max(400, cellWidth),
              minHeight: '140px',
              background: '#ffffff',
              border: '2px solid #3F6212',
              borderRadius: '6px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              resize: 'both',
              overflow: 'auto',
            }}
          >
            <textarea
              ref={longTextRef}
              value={localVal}
              onChange={(e) => {
                const v = e.target.value;
                setLocalVal(v);
                if (longTextDebounceRef.current) clearTimeout(longTextDebounceRef.current);
                longTextDebounceRef.current = setTimeout(() => {
                  onUpdate(v);
                }, 400);
              }}
              onKeyDown={handleLongTextKeyDown}
              style={{
                flex: 1,
                minHeight: '100px',
                fontSize: '13px',
                fontFamily: 'inherit',
                color: '#0f172a',
                padding: '8px 10px',
                outline: 'none',
                border: 'none',
                resize: 'none',
                lineHeight: 1.5,
                background: 'transparent',
              }}
              placeholder="輸入多行文字..."
            />
            {/* Bottom bar: char count + expand button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              borderRadius: '0 0 4px 4px',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {charCount} 字元
              </span>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsLongTextExpanded(true);
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px',
                  background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#475569',
                }}
                title="展開全螢幕"
              >
                <Maximize2 size={12} />
                展開
              </button>
            </div>
          </PopoverPortal>
        );
      }

      if (field.type === 'latest_comment') {
        return createPortal(
          <LatestCommentModal
            show={true}
            fieldName={field.name}
            value={value}
            onChange={(newEntries) => {
              onUpdate(newEntries);
            }}
            onClose={() => onCancelEdit()}
            readOnly={false}
          />,
          document.body
        );
      }

      if (['autonumber', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'formula', 'lookup', 'rollup'].includes(field.type)) {
        onCancelEdit();
        return null;
      }

      const inputType = field.type === 'date' ? 'date' 
        : field.type === 'email' ? 'email' 
        : field.type === 'url' ? 'url' 
        : (field.type === 'phone' || field.type === 'phone_number') ? 'tel' 
        : 'text';

      return (
        <input
          ref={inputRef}
          type={inputType}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          value={localVal}
          onChange={(e) => {
            const nextVal = e.target.value;
            setLocalVal(nextVal);
            if (field.type === 'date' && nextVal) {
              onUpdate(nextVal);
            }
          }}
          onBlur={() => {
            hasCommittedRef.current = true;
            if (field.type === 'number') {
              onUpdate(parseNumberInput(localVal));
            } else {
              onUpdate(localVal);
            }
            onCancelEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              hasCommittedRef.current = true;
              const isShift = e.shiftKey;
              if (field.type === 'number') {
                onUpdate(parseNumberInput(localVal));
              } else {
                onUpdate(localVal);
              }
              onCancelEdit();
              onNavigateCell?.(isShift ? 'prevRow' : 'nextRow');
            } else if (e.key === 'Tab') {
              e.preventDefault();
              hasCommittedRef.current = true;
              const isShift = e.shiftKey;
              if (field.type === 'number') {
                onUpdate(parseNumberInput(localVal));
              } else {
                onUpdate(localVal);
              }
              onCancelEdit();
              onNavigateCell?.(isShift ? 'prevCol' : 'nextCol');
            } else if (e.key === 'ArrowDown' && ['text', 'number', 'email', 'url', 'phone', 'phone_number'].includes(field.type)) {
              e.preventDefault();
              hasCommittedRef.current = true;
              if (field.type === 'number') {
                onUpdate(parseNumberInput(localVal));
              } else {
                onUpdate(localVal);
              }
              onCancelEdit();
              onNavigateCell?.('nextRow');
            } else if (e.key === 'ArrowUp' && ['text', 'number', 'email', 'url', 'phone', 'phone_number'].includes(field.type)) {
              e.preventDefault();
              hasCommittedRef.current = true;
              if (field.type === 'number') {
                onUpdate(parseNumberInput(localVal));
              } else {
                onUpdate(localVal);
              }
              onCancelEdit();
              onNavigateCell?.('prevRow');
            } else if (e.key === 'Escape') {
              hasCommittedRef.current = true;
              onCancelEdit();
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            border: 'none',
            boxShadow: 'inset 0 0 0 2px #3F6212',
            outline: 'none',
            background: '#ffffff',
            fontSize: '13px',
            fontFamily: field.type === 'number' ? 'monospace' : 'inherit',
            textAlign: field.type === 'number' ? 'right' : 'left',
            padding: '0 8px',
            margin: 0,
            color: '#0f172a',
            zIndex: 10
          }}
        />
      );
    }

    if (field.type === 'boolean') {
      const isChecked = value === 'true' || value === '1' || value === 'yes' || value === true;
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            style={{ width: '14px', height: '14px', cursor: 'pointer', pointerEvents: 'none' }}
          />
        </div>
      );
    }

    if (field.type === 'single_select' || field.type === 'multiple_select') {
      const choiceObjects = getFieldChoiceObjects();
      const items = parseSelectItems(value, field.options);

      return (
        <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', flexWrap: 'nowrap', width: '100%' }}>
          {items.map((itemStr, i) => {
            const { bg, text } = getOptionColor(itemStr, choiceObjects);
            return (
              <span 
                key={i} 
                style={{ 
                  background: bg, 
                  color: text, 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px', 
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title={itemStr}
              >
                {itemStr}
              </span>
            );
          })}
        </div>
      );
    }

    if (field.type === 'collaborator' || field.type === 'collaborators') {
      let collabItems: Array<{ id: number; username: string }> = [];
      if (Array.isArray(value)) {
        collabItems = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return { id: Number(item.id), username: String(item.username || item.name || `ID: ${item.id}`) };
          }
          return { id: Number(item), username: `ID: ${item}` };
        });
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            collabItems = parsed.map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                return { id: Number(item.id), username: String(item.username || item.name || `ID: ${item.id}`) };
              }
              return { id: Number(item), username: `ID: ${item}` };
            });
          }
        } catch {}
      }

      if (collabItems.length > 0) {
        return (
          <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', flexWrap: 'nowrap', width: '100%' }}>
            {collabItems.map((item, i) => (
              <span key={i} style={{ background: '#F4F4F5', color: '#4338ca', border: '1px solid #a3e635', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 500, flexShrink: 0 }}>
                {item.username}
              </span>
            ))}
          </div>
        );
      }

      return null;
    }

    if (field.type === 'latest_comment') {
      const entries = parseLatestCommentEntries(value);
      const latest = entries.length > 0 ? entries[entries.length - 1] : null;

      const getDateOnly = (timeStr?: string) => {
        if (!timeStr) return '';
        const trimmed = timeStr.trim();
        if (trimmed.includes(' ')) return trimmed.split(' ')[0];
        if (trimmed.includes('T')) return trimmed.split('T')[0];
        return trimmed;
      };

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', padding: '0 8px', height: '100%', width: '100%', overflow: 'hidden' }}>
          {latest ? (
            <>
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
                title={latest.content}
              >
                {latest.content}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {getDateOnly(latest.time)}
              </span>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
              <MessageSquare size={12} />
              <span>+ 新增留言...</span>
            </div>
          )}
        </div>
      );
    }

    if (field.type === 'link_row') {
      const primaryField = targetFields[0];
      const primaryKey = primaryField ? `field_${primaryField.id}` : null;

      const formatItem = (item: any) => {
        if (typeof item === 'object' && item !== null) {
          const numId = Number(item.id || 0);
          const isDenied = Boolean(item._accessDenied);
          if (isDenied) {
            return { id: numId, _accessDenied: true, value: '無存取權限' };
          }
          let label = String(item.value || '');
          if (!label || label.startsWith('列 ID:')) {
            const rRow = relationRows.find(r => r.id === numId);
            if (rRow) {
              if (primaryKey && rRow.data?.[primaryKey]) {
                label = String(rRow.data[primaryKey]);
              } else {
                const firstVal = Object.values(rRow.data || {}).find(v => v != null && v !== '' && typeof v !== 'object');
                if (firstVal) label = String(firstVal);
              }
            }
          }
          return { id: numId, value: label || `列 ID: ${numId}`, _accessDenied: false, previewFields: item.previewFields, tableName: item.tableName };
        }
        const numId = Number(item);
        let label = '';
        const rRow = relationRows.find(r => r.id === numId);
        if (rRow) {
          if (primaryKey && rRow.data?.[primaryKey]) {
            label = String(rRow.data[primaryKey]);
          } else {
            const firstVal = Object.values(rRow.data || {}).find(v => v != null && v !== '' && typeof v !== 'object');
            if (firstVal) label = String(firstVal);
          }
        }
        return { id: numId, value: label || `列 ID: ${numId}`, _accessDenied: false };
      };

      let linkItems: any[] = [];
      if (Array.isArray(value)) {
        linkItems = value.map(formatItem);
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            linkItems = parsed.map(formatItem);
          }
        } catch {}
      }

      return (
        <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', width: '100%', flexWrap: 'nowrap' }}>
          {linkItems.map((item, i) => (
            <LinkedRowCardChip
              key={i}
              item={item}
              onOpenDetail={(id, e) => openRowDetail(id, e)}
            />
          ))}
        </div>
      );
    }

    if (field.type === 'long_text') {
      const textStr = value !== null && value !== undefined ? String(value) : '';
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', padding: '4px 8px', overflow: 'hidden', gap: '4px', height: '100%', maxHeight: '100%' }}>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', flex: 1, fontSize: '13px', color: '#1e293b', lineHeight: '1.35', maxHeight: '100%' }}>
            {textStr}
          </span>
          {isCellHovered && !isEditing && Boolean(textStr) && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '20px', height: '20px',
                background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px',
                cursor: 'pointer', flexShrink: 0, color: '#64748b', alignSelf: 'flex-start'
              }}
              title="展開編輯"
            >
              <Maximize2 size={12} />
            </span>
          )}
        </div>
      );
    }

    if (field.type === 'rating') {
      const ratingVal = Math.min(5, Math.max(0, parseInt(String(value || 0)) || 0));
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '0 8px', width: '100%' }}>
          {[1, 2, 3, 4, 5].map((starNum) => (
            <span
              key={starNum}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(starNum === ratingVal ? 0 : starNum);
              }}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.1s ease' }}
            >
              <Star
                size={14}
                fill={starNum <= ratingVal ? '#f59e0b' : '#e2e8f0'}
                color={starNum <= ratingVal ? '#F59E0B' : '#E4E4E7'}
              />
            </span>
          ))}
        </div>
      );
    }


    if (field.type === 'url') {
      const urlStr = value != null ? String(value).trim() : '';
      if (!urlStr) return null;
      const href = urlStr.startsWith('http://') || urlStr.startsWith('https://') ? urlStr : `https://${urlStr}`;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%' }}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#EA580C', textDecoration: 'underline', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', fontSize: '13px', maxHeight: '100%', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Link2 size={12} color="#EA580C" style={{ flexShrink: 0 }} />
            <span>{urlStr}</span>
          </a>
        </div>
      );
    }

    if (field.type === 'email') {
      const emailStr = value != null ? String(value).trim() : '';
      if (!emailStr) return null;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%' }}>
          <a
            href={`mailto:${emailStr}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#EA580C', textDecoration: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', fontSize: '13px', maxHeight: '100%', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Mail size={12} color="#EA580C" style={{ flexShrink: 0 }} />
            <span>{emailStr}</span>
          </a>
        </div>
      );
    }

    if (field.type === 'phone' || field.type === 'phone_number') {
      const phoneStr = value != null ? String(value).trim() : '';
      if (!phoneStr) return null;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%' }}>
          <a
            href={`tel:${phoneStr}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#0f172a', textDecoration: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', fontSize: '13px', maxHeight: '100%' }}
          >
            📞 {phoneStr}
          </a>
        </div>
      );
    }

    if (field.type === 'file' || field.type === 'attachment') {
      let fileList: Array<{ url?: string; name?: string }> = [];
      if (Array.isArray(value)) {
        fileList = value;
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) fileList = parsed;
          else if (typeof parsed === 'object' && parsed !== null) fileList = [parsed];
          else fileList = [{ name: value }];
        } catch {
          fileList = [{ name: value }];
        }
      } else if (typeof value === 'object' && value !== null) {
        fileList = [value];
      }

      if (fileList.length === 0) return null;

      return (
        <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', width: '100%', flexWrap: 'nowrap' }}>
          {fileList.map((file, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '1px 6px',
                fontSize: '11px',
                color: '#334155',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={file.name || '附件'}
            >
              <Paperclip size={11} color="#EA580C" />
              <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name || '附件'}
              </span>
            </span>
          ))}
        </div>
      );
    }

    if (field.type === 'autonumber') {
      return (
        <span style={{ fontFamily: 'monospace', padding: '0 8px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
          #{value ?? ''}
        </span>
      );
    }

    if (field.type === 'number') {
      const formatted = formatNumberValue(value, field.options);
      return (
        <span style={{ width: '100%', padding: '0 8px', textAlign: 'right', fontSize: '13px', color: '#1e293b', fontFamily: 'monospace', fontWeight: 500 }}>
          {formatted}
        </span>
      );
    }

    if (field.type === 'created_on' || field.type === 'last_modified_on') {
      const dStr = value ? formatDateValue(value) : '';
      if (!dStr) return null;
      return (
        <span style={{ padding: '0 8px', fontSize: '12px', color: '#64748b', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', maxHeight: '100%' }}>
          🕒 {dStr}
        </span>
      );
    }

    if (field.type === 'created_by' || field.type === 'last_modified_by') {
      return (
        <span style={{ padding: '0 8px', fontSize: '12px', color: '#475569', fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', maxHeight: '100%' }}>
          👤 {value ? String(value) : '系統'}
        </span>
      );
    }

    if (field.type === 'boolean') {
      const isChecked = Boolean(value === true || value === 'true' || value === 1 || value === '1');
      return (
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onUpdate(!isChecked);
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              border: isChecked ? '1px solid #3F6212' : '1px solid #cbd5e1',
              backgroundColor: isChecked ? '#3F6212' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              boxShadow: isChecked ? '0 1px 2px rgba(63, 98, 18, 0.2)' : 'none'
            }}
          >
            {isChecked && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      );
    }

    if (field.type === 'formula') {
      return renderFormulaCell(value);
    }

    if (field.type === 'lookup' || field.type === 'rollup') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%', background: 'rgba(248, 250, 252, 0.6)', height: '100%' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>ƒ</span>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', fontSize: '13px', color: '#334155', maxHeight: '100%', lineHeight: '1.35' }}>
            {value !== null && value !== undefined ? String(value) : ''}
          </span>
        </div>
      );
    }

    if (field.type === 'password') {
      const pwdStr = value != null ? String(value) : '';
      return (
        <span style={{ padding: '0 8px', fontSize: '13px', color: '#64748b', letterSpacing: '2px', fontFamily: 'monospace' }}>
          {pwdStr ? '••••••••' : ''}
        </span>
      );
    }

    if (field.type === 'uuid') {
      const uuidStr = value != null ? String(value) : '';
      return (
        <span style={{ padding: '0 8px', fontSize: '11px', color: '#64748b', fontFamily: 'monospace', background: '#f1f5f9', borderRadius: '4px', margin: '0 4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', maxHeight: '100%' }}>
          {uuidStr}
        </span>
      );
    }

    if (field.type === 'duration') {
      const durVal = value != null ? String(value) : '';
      if (!durVal) return null;
      return (
        <span style={{ padding: '0 8px', fontSize: '13px', color: '#334155', fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} color="#EA580C" style={{ flexShrink: 0 }} />
          <span>{durVal}</span>
        </span>
      );
    }

    if (field.type === 'edit_row_link') {
      if (!isCellHovered) return null;
      return (
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}>
          <span style={{ padding: '2px 8px', fontSize: '12px', color: '#18181B', background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: '4px' }}>
            Expand row ↗
          </span>
        </div>
      );
    }

    if (field.type === 'ai_prompt') {
      const aiStr = value != null ? String(value) : '';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%', height: '100%' }}>
          <Sparkles size={13} color="#EA580C" style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', fontSize: '13px', color: '#4c1d95', maxHeight: '100%', lineHeight: '1.35' }}>
            {aiStr || 'Generative AI Prompt'}
          </span>
        </div>
      );
    }

    if (field.type === 'date') {
      const dateDisplay = formatDateValue(value);
      return (
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', width: '100%', padding: '0 8px', fontSize: '13px', color: '#1e293b', maxHeight: '100%', lineHeight: '1.35' }}>
          {dateDisplay}
        </span>
      );
    }

    return (
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', overflow: 'hidden', width: '100%', padding: '0 8px', fontSize: '13px', color: '#1e293b', maxHeight: '100%', lineHeight: '1.35' }}>
        {value !== null && value !== undefined ? String(value) : ''}
      </span>
    );
  };

  const cellWidth = field.width || 180;

  let cellBg: string | undefined = undefined;

  if (isInRange) {
    cellBg = 'rgba(63, 98, 18, 0.12)';
  } else if (isRowSelected) {
    cellBg = isCellHovered ? 'rgba(63, 98, 18, 0.12)' : 'rgba(63, 98, 18, 0.08)';
  } else if (isSelected) {
    cellBg = 'rgba(63, 98, 18, 0.04)';
  } else if (isCellHovered) {
    cellBg = 'rgba(226, 232, 240, 0.7)';
  } else if (isRowHovered) {
    cellBg = '#f8fafc';
  }

  let cellShadow: string | undefined = undefined;
  if (isEditing) {
    cellShadow = undefined;
  } else if (isInRange && rangeEdges) {
    const borders: string[] = [];
    if (rangeEdges.top) borders.push('inset 0 2px 0 0 #3F6212');
    if (rangeEdges.bottom) borders.push('inset 0 -2px 0 0 #3F6212');
    if (rangeEdges.left) borders.push('inset 2px 0 0 0 #3F6212');
    if (rangeEdges.right) borders.push('inset -2px 0 0 0 #3F6212');
    cellShadow = borders.length > 0 ? borders.join(', ') : undefined;
  } else if (isSelected) {
    // Single selected cell focus outline
    cellShadow = 'inset 0 0 0 2px #3F6212';
  } else if (isInAutofillRange) {
    // Real-time bounding box highlight for autofill preview
    cellShadow = 'inset 0 0 0 2px #84cc16';
  }

  // Combine selection shadow with primary column shadow if isPrimary
  let finalBoxShadow = cellShadow;
  if (isPrimary) {
    const primaryShadow = '2px 0 5px -2px rgba(0, 0, 0, 0.12)';
    finalBoxShadow = cellShadow ? `${cellShadow}, ${primaryShadow}` : primaryShadow;
  }

  // Determine if autofill handle should render at bottom-right corner of selection
  const showAutofillHandle = !isEditing && (
    (isSelected && (!isInRange || !rangeEdges)) ||
    (isInRange && Boolean(rangeEdges?.bottom && rangeEdges?.right))
  );

  const wasSelectedRef = useRef(isSelected);

  return (
    <div
      ref={cellRef}
      onMouseDown={(e) => {
        wasSelectedRef.current = isSelected;
        if (!isEditing) {
          if (e.button === 0) {
            onSelect(e);
          } else if (e.button === 2 && !isInRange && !isSelected) {
            onSelect(e);
          }
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onTouchStart={() => {
        wasSelectedRef.current = isSelected;
      }}
      onClick={() => {
        // Mobile: 1st tap selects cell, 2nd tap on already-selected cell enters edit mode
        if (typeof window !== 'undefined' && window.innerWidth < 768 && wasSelectedRef.current && !isEditing) {
          const readOnlyTypes = ['lookup', 'rollup', 'count', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'autonumber', 'formula'];
          if (!readOnlyTypes.includes(field.type)) {
            if (field.type === 'boolean') {
              const isChecked = Boolean(value === true || value === 'true' || value === 1 || value === '1');
              onUpdate(!isChecked);
            } else {
              onStartEdit();
            }
          }
        }
      }}
      onMouseEnter={() => {
        setIsCellHovered(true);
        if (!isEditing) {
          onMouseEnterCell?.();
        }
      }}
      onMouseLeave={() => {
        setIsCellHovered(false);
      }}
      onDoubleClick={() => {
        if (field.type === 'boolean') {
          const isChecked = Boolean(value === true || value === 'true' || value === 1 || value === '1');
          onUpdate(!isChecked);
        } else if (field.type === 'formula') {
          onUpdateField?.(field.id, {});
        } else if (!['lookup', 'rollup', 'count', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'autonumber'].includes(field.type)) {
          onStartEdit();
        }
      }}
      style={{ 
        width: `var(--field-width-${field.id}, ${cellWidth}px)`,
        minWidth: `var(--field-width-${field.id}, ${cellWidth}px)`,
        maxWidth: `var(--field-width-${field.id}, ${cellWidth}px)`,
        flexShrink: 0,
        position: isPrimary ? 'sticky' : 'relative',
        left: isPrimary ? `${rowDetailsWidth}px` : undefined,
        boxShadow: finalBoxShadow,
        borderRight: isPrimary ? '2px solid var(--border-color, #cbd5e1)' : '1px solid var(--border-color, #e2e8f0)',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        background: cellBg ? `linear-gradient(${cellBg}, ${cellBg}), ${rowColorBg || '#ffffff'}` : (rowColorBg || '#ffffff'),
        transition: 'background 0.12s ease, box-shadow 0.12s ease',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        height: 'var(--row-height, 32px)',
        maxHeight: 'var(--row-height, 32px)',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'manipulation',
        zIndex: isEditing ? 100 : (isPrimary ? 14 : (isSelected || isInRange ? 10 : undefined))
      }}
      className={`grid-view__column ${isSelected || isInRange ? 'active' : ''}`}
    >
      {renderCellContent()}

      {/* Baserow Autofill handle square at bottom right of selected area */}
      {showAutofillHandle && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartAutofill?.(e);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onAutoFillDown?.();
          }}
          title="拖曳填滿；雙擊自動向下填滿"
          style={{ position: 'absolute', right: '-1px', bottom: '-1px', width: '6px', height: '6px', backgroundColor: '#18181B', cursor: 'crosshair', zIndex: 20 }}
        />
      )}

      {/* Slide-over CardDrawer for viewing & editing linked target row */}
      {Boolean(activeDetailRowId && targetTableId) && (
        <CardDrawer
          show={Boolean(activeDetailRowId)}
          tableId={targetTableId}
          rowId={activeDetailRowId}
          onClose={() => setActiveDetailRowId(null)}
        />
      )}

    </div>
  );
};

