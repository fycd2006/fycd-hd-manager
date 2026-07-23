'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { TableField } from '@/modules/database/types';
import { formatDateValue } from '@/modules/database/utils';

const BASEROW_PALETTE = [
  { bg: '#fef3c7', text: '#92400e' }, // Soft yellow (西西)
  { bg: '#fca5a5', text: '#7f1d1d' }, // Soft red/coral (哈哈)
  { bg: '#fef08a', text: '#854d0e' }, // Soft gold/amber (1211)
  { bg: '#dcfce7', text: '#14532d' }, // Soft green
  { bg: '#dbeafe', text: '#1e40af' }, // Soft blue
  { bg: '#f3e8ff', text: '#581c87' }, // Soft purple
  { bg: '#fce7f3', text: '#831843' }, // Soft pink
  { bg: '#ffedd5', text: '#7c2d12' }, // Soft orange
];

const getOptionColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % BASEROW_PALETTE.length;
  const palette = BASEROW_PALETTE[idx];
  return {
    backgroundColor: palette.bg,
    color: palette.text,
    bg: palette.bg,
    text: palette.text
  };
};

const parseSelectItems = (val: any): string[] => {
  if (val === null || val === undefined || val === '') return [];
  if (Array.isArray(val)) {
    return val.map(item => typeof item === 'object' ? (item.value || item.name || item.id || String(item)) : String(item)).filter(Boolean);
  }
  if (typeof val === 'object') {
    if (Array.isArray(val.choices)) return val.choices.map(String).filter(Boolean);
    if (val.value || val.name || val.id) return [String(val.value || val.name || val.id)];
    return [String(val)];
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      let parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      return parseSelectItems(parsed);
    } catch {
      return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [String(val)];
};

interface GridViewCellProps {
  rowId: number;
  field: TableField;
  value: any;
  isSelected: boolean;
  isEditing: boolean;
  isInRange?: boolean;
  isRowSelected?: boolean;
  rangeEdges?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  isPrimary?: boolean;
  rowColorBg?: string | null;
  rowDetailsWidth?: number;
  onSelect: (e?: React.MouseEvent) => void;
  onMouseEnterCell?: () => void;
  onStartAutofill?: (e: React.MouseEvent) => void;
  onStartEdit: () => void;
  onUpdate: (val: any) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onCancelEdit: () => void;
}

export const GridViewCell: React.FC<GridViewCellProps> = ({
  rowId,
  field,
  value,
  isSelected,
  isEditing,
  isInRange,
  isRowSelected,
  rangeEdges,
  isPrimary = false,
  rowColorBg,
  rowDetailsWidth = 56,
  onSelect,
  onMouseEnterCell,
  onStartAutofill,
  onStartEdit,
  onUpdate,
  onUpdateField,
  onCancelEdit,
}) => {
  const getInitialStringValue = (val: any, type: string): string => {
    if (val === null || val === undefined) return '';
    if (type === 'boolean') return String(val);
    if (type === 'date') return formatDateValue(val);
    const items = parseSelectItems(val);
    if (items.length > 0) return items.join(', ');
    return String(val);
  };

  const cleanChoice = (item: any): string[] => {
    if (item === null || item === undefined || item === '') return [];
    if (typeof item === 'object') {
      if (Array.isArray(item.choices)) return item.choices.flatMap(cleanChoice);
      if (item.value || item.name || item.id) return [String(item.value || item.name || item.id)];
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

  const getFieldOptions = (): string[] => {
    if (!field.options) return [];
    let rawItems: any[] = [];
    try {
      let parsed = typeof field.options === 'string' ? JSON.parse(field.options) : field.options;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      if (Array.isArray(parsed)) rawItems = parsed;
      else if (parsed && Array.isArray(parsed.choices)) rawItems = parsed.choices;
      else if (parsed && Array.isArray(parsed.select_options)) rawItems = parsed.select_options;
    } catch {
      // Fallback below
    }
    if (rawItems.length === 0 && typeof field.options === 'string') {
      rawItems = field.options.split(',');
    }
    const cleaned = rawItems.flatMap(cleanChoice);
    return Array.from(new Set(cleaned));
  };

  const [localVal, setLocalVal] = useState<string>(getInitialStringValue(value, field.type));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalVal(getInitialStringValue(value, field.type));
  }, [value, field.type]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (typeof (inputRef.current as any).select === 'function') {
        (inputRef.current as any).select();
      }
    }
  }, [isEditing]);

  const handleBlur = () => {
    onUpdate(localVal);
  };

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

  useEffect(() => {
    if (isEditing && field.type === 'long_text' && cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const editorW = Math.max(400, rect.width);
      const editorH = 200;
      // Ensure editor doesn't overflow viewport
      let top = rect.top;
      let left = rect.left;
      if (top + editorH > viewportH - 16) top = Math.max(8, viewportH - editorH - 16);
      if (left + editorW > viewportW - 16) left = Math.max(8, viewportW - editorW - 16);
      setPopoverPos({ top, left, width: editorW });
    }
    if (!isEditing) {
      setIsLongTextExpanded(false);
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
            setTempSelectedItems(prev => [...prev, { id: targetId, value: primaryVal }]);
          }
        };

        const handleConfirmRelation = () => {
          onUpdate(tempSelectedItems);
          onCancelEdit();
        };

        const modalContent = (
          <div
            data-relation-modal="true"
            className="portal-modal"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmRelation();
            }}
          >
            <div
              data-relation-modal="true"
              className="portal-modal"
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
              onMouseDown={(e) => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search rows (支援全欄位比對)..."
                    value={relationSearch}
                    onChange={e => setRelationSearch(e.target.value)}
                    style={{ flex: 1, padding: '6px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    已選擇 {currentIds.length} 項
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
                  style={{ padding: '6px 16px', background: '#6366f1', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        );

        return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
      }

      if (field.type === 'boolean') {
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', boxShadow: 'inset 0 0 0 2px #2563eb', zIndex: 10 }}>
            <input
              type="checkbox"
              checked={localVal === 'true' || localVal === '1' || localVal === 'yes'}
              onChange={(e) => {
                const checked = e.target.checked ? 'true' : 'false';
                setLocalVal(checked);
                onUpdate(checked);
              }}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
          </div>
        );
      }

      if (field.type === 'single_select') {
        const options = getFieldOptions();
        const filteredOptions = options.filter(opt => opt.toLowerCase().includes(comboSearch.toLowerCase()));
        const isExactMatch = options.some(opt => opt.toLowerCase() === comboSearch.toLowerCase());

        return (
          <div 
            tabIndex={0}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                 onUpdate(localVal);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit();
              if (e.key === 'Enter' && comboSearch) {
                 const finalVal = comboSearch;
                 if (!isExactMatch && onUpdateField) {
                   const newOptions = [...options, comboSearch];
                   onUpdateField(field.id, { options: { choices: newOptions } as any });
                 }
                 setLocalVal(finalVal);
                 onUpdate(finalVal);
                 onCancelEdit();
              }
            }}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              background: '#fff', boxShadow: 'inset 0 0 0 2px #2563eb', 
              zIndex: 9999, display: 'flex', outline: 'none', boxSizing: 'border-box',
              alignItems: 'center', padding: '0 8px'
            }}
          >
            {localVal ? (
              <span style={{ ...getOptionColor(localVal), padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', whiteSpace: 'nowrap' }}>
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
            
            {/* Dropdown Menu */}
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '200px',
              background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
              borderRadius: '6px', maxHeight: '250px', display: 'flex', flexDirection: 'column', zIndex: 10000
            }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  ref={inputRef as any}
                  autoFocus
                  type="text"
                  value={comboSearch}
                  onChange={(e) => setComboSearch(e.target.value)}
                  placeholder="搜尋或輸入新增..."
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', marginLeft: '8px', fontSize: '13px' }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: '4px 0', flex: 1 }}>
                {filteredOptions.map((opt, i) => {
                  const { bg, text } = getOptionColor(opt);
                  const isSelected = localVal === opt;
                  return (
                    <div 
                      key={i} 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLocalVal(opt);
                        onUpdate(opt);
                        onCancelEdit();
                      }}
                      style={{ padding: '6px 12px', cursor: 'pointer', background: isSelected ? '#f8fafc' : 'transparent', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#f8fafc' : 'transparent'}
                    >
                      <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px' }}>
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
                      if (onUpdateField) {
                        const newOptions = [...options, comboSearch];
                        onUpdateField(field.id, { options: { choices: newOptions } as any });
                      }
                      setLocalVal(comboSearch);
                      onUpdate(comboSearch);
                      onCancelEdit();
                    }}
                    style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#2563eb', fontStyle: 'italic' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    建立 "{comboSearch}"
                  </div>
                )}
                {filteredOptions.length === 0 && !comboSearch && (
                  <div style={{ padding: '6px 12px', fontSize: '12px', color: '#94a3b8' }}>無選項，請直接搜尋建立</div>
                )}
              </div>
            </div>
          </div>
        );
      }

      if (field.type === 'multiple_select') {
        const options = getFieldOptions();
        let currentItems: string[] = [];
        try { currentItems = JSON.parse(localVal); if (!Array.isArray(currentItems)) currentItems = [localVal]; } 
        catch { currentItems = localVal.split(',').map(s => s.trim()).filter(Boolean); }
        
        const filteredOptions = options.filter(opt => opt.toLowerCase().includes(comboSearch.toLowerCase()));
        const isExactMatch = options.some(opt => opt.toLowerCase() === comboSearch.toLowerCase());
        const searchAlreadySelected = currentItems.some(item => item.toLowerCase() === comboSearch.toLowerCase());

        return (
          <div 
            tabIndex={0}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                 handleBlur();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit();
              if (e.key === 'Enter' && comboSearch && !searchAlreadySelected) {
                 if (!isExactMatch && onUpdateField) {
                   const newOptions = [...options, comboSearch];
                   onUpdateField(field.id, { options: { choices: newOptions } as any });
                 }
                 const nextItems = [...currentItems, comboSearch];
                 const nextVal = JSON.stringify(nextItems);
                 setLocalVal(nextVal);
                 onUpdate(nextVal);
                 setComboSearch(''); // reset search after enter
                 e.preventDefault(); // prevent ending edit
              }
            }}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', minHeight: '100%', 
              background: '#fff', boxShadow: 'inset 0 0 0 2px #2563eb', 
              zIndex: 9999, display: 'flex', outline: 'none', boxSizing: 'border-box',
              flexWrap: 'wrap', gap: '4px', padding: '4px 8px', alignItems: 'center'
            }}
          >
            {currentItems.map((item, i) => {
              const { bg, text } = getOptionColor(item);
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
            
            {/* Dropdown Menu */}
            <div
              data-grid-portal="true"
              style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '200px',
              background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
              borderRadius: '6px', maxHeight: '250px', display: 'flex', flexDirection: 'column', zIndex: 10000
            }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  ref={inputRef as any}
                  autoFocus
                  type="text"
                  value={comboSearch}
                  onChange={(e) => setComboSearch(e.target.value)}
                  placeholder="搜尋或輸入新增..."
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', marginLeft: '8px', fontSize: '13px' }}
                />
              </div>
              <div style={{ overflowY: 'auto', padding: '4px 0', flex: 1 }}>
                {filteredOptions.map((opt, i) => {
                  const isSelected = currentItems.includes(opt);
                  const { bg, text } = getOptionColor(opt);
                  return (
                    <div 
                      key={i} 
                      onMouseDown={(e) => {
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
                        background: isSelected ? '#f8fafc' : 'transparent', 
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}
                      onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#f8fafc' : 'transparent'}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div click
                        style={{ margin: 0, cursor: 'pointer', pointerEvents: 'none' }}
                      />
                      <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px' }}>
                        {opt}
                      </span>
                    </div>
                  );
                })}
                {comboSearch && !isExactMatch && !searchAlreadySelected && (
                  <div 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onUpdateField) {
                        const newOptions = [...options, comboSearch];
                        onUpdateField(field.id, { options: { choices: newOptions } as any });
                      }
                      const nextItems = [...currentItems, comboSearch];
                      const nextVal = JSON.stringify(nextItems);
                      setLocalVal(nextVal);
                      onUpdate(nextVal);
                      setComboSearch('');
                    }}
                    style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#2563eb', fontStyle: 'italic' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    建立 "{comboSearch}"
                  </div>
                )}
                {filteredOptions.length === 0 && !comboSearch && (
                  <div style={{ padding: '6px 12px', fontSize: '12px', color: '#94a3b8' }}>無選項，請直接搜尋建立</div>
                )}
              </div>
            </div>
          </div>
        );
      }

      if (field.type === 'long_text') {
        const charCount = localVal.length;
        const wordCount = localVal.trim() ? localVal.trim().split(/\s+/).length : 0;

        if (isLongTextExpanded) {
          // Fullscreen modal overlay
          return typeof document !== 'undefined' && createPortal(
            <div
              data-longtext-portal="true"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999998,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  onUpdate(localVal);
                  setIsLongTextExpanded(false);
                  onCancelEdit();
                }
              }}
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
                    onUpdate(v);
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
            </div>,
            document.body
          );
        }

        // Inline expanded editor (portal over cell)
        return typeof document !== 'undefined' && createPortal(
          <>
            {/* Invisible backdrop to catch click-outside */}
            <div
              data-longtext-portal="true"
              style={{ position: 'fixed', inset: 0, zIndex: 999998 }}
              onMouseDown={() => {
                onUpdate(localVal);
                onCancelEdit();
              }}
            />
            {/* Editor container */}
            <div
              data-longtext-portal="true"
              style={{
                position: 'fixed',
                top: popoverPos ? popoverPos.top - 1 : 0,
                left: popoverPos ? popoverPos.left - 1 : 0,
                width: popoverPos ? popoverPos.width : Math.max(400, cellWidth),
                minHeight: '140px',
                background: '#ffffff',
                border: '2px solid #2563eb',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                zIndex: 999999,
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
                  onUpdate(v);
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
            </div>
          </>,
          document.body
        );
      }

      if (['autonumber', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'formula', 'lookup', 'rollup'].includes(field.type)) {
        onCancelEdit();
        return null;
      }

      const inputType = field.type === 'number' ? 'number' 
        : field.type === 'date' ? 'date' 
        : field.type === 'email' ? 'email' 
        : field.type === 'url' ? 'url' 
        : field.type === 'phone' ? 'tel' 
        : 'text';

      return (
        <input
          ref={inputRef}
          type={inputType}
          value={localVal}
          onChange={(e) => {
            const nextVal = e.target.value;
            setLocalVal(nextVal);
            if (field.type === 'date' && nextVal) {
              onUpdate(nextVal);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            border: 'none',
            boxShadow: 'inset 0 0 0 2px #2563eb',
            outline: 'none',
            background: '#ffffff',
            fontSize: '13px',
            fontFamily: 'inherit',
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
      const items = parseSelectItems(value);
      
      if (items.length > 0) {
        const visibleItems = items.slice(0, 3);
        const hiddenCount = items.length - visibleItems.length;

        return (
          <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', flexWrap: 'nowrap', width: '100%' }}>
            {visibleItems.map((itemStr, i) => {
              const { bg, text } = getOptionColor(itemStr);
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
                    textOverflow: 'ellipsis', 
                    overflow: 'hidden',
                    maxWidth: '120px',
                    display: 'inline-block'
                  }}
                  title={itemStr}
                >
                  {itemStr}
                </span>
              );
            })}
            {hiddenCount > 0 && (
              <span style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, flexShrink: 0 }} title={`另有 ${hiddenCount} 個選項`}>
                +{hiddenCount}
              </span>
            )}
          </div>
        );
      }
    }

    if (field.type === 'collaborator') {
      // Parse collaborator value: [{id, username}] or JSON string thereof
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
              <span key={i} style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #a5b4fc', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {item.username}
              </span>
            ))}
          </div>
        );
      }

      if (collabItems.length > 0) {
        return (
          <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', flexWrap: 'nowrap', width: '100%' }}>
            {collabItems.map((item, i) => (
              <span key={i} style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #a5b4fc', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {item.username}
              </span>
            ))}
          </div>
        );
      }

      return null;
    }

    if (field.type === 'link_row') {
      const primaryField = targetFields[0];
      const primaryKey = primaryField ? `field_${primaryField.id}` : null;

      const formatItem = (item: any): { id: number; value: string } => {
        if (typeof item === 'object' && item !== null) {
          const numId = Number(item.id || 0);
          let label = String(item.value || '');
          if (!label || label.startsWith('列 ID:')) {
            const rRow = relationRows.find(r => r.id === numId);
            if (rRow && primaryKey && rRow.data?.[primaryKey]) {
              label = String(rRow.data[primaryKey]);
            }
          }
          return { id: numId, value: label || `列 ID: ${numId}` };
        }
        const numId = Number(item);
        let label = '';
        const rRow = relationRows.find(r => r.id === numId);
        if (rRow && primaryKey && rRow.data?.[primaryKey]) {
          label = String(rRow.data[primaryKey]);
        }
        return { id: numId, value: label || `列 ID: ${numId}` };
      };

      let linkItems: Array<{ id: number; value: string }> = [];
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

      const visibleLinks = linkItems.slice(0, 4);
      const hiddenLinkCount = linkItems.length - visibleLinks.length;
      const showControls = isCellHovered && !isEditing;

      return (
        <div style={{ display: 'flex', gap: '4px', padding: '0 6px', overflow: 'hidden', alignItems: 'center', height: '100%', width: '100%', flexWrap: 'nowrap' }}>
          {visibleLinks.map((item, i) => (
            <span 
              key={i} 
              style={{ 
                background: '#f1f5f9', 
                color: '#1e293b', 
                padding: '2px 8px', 
                borderRadius: '6px', 
                fontSize: '13px', 
                fontWeight: 500,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                maxWidth: '130px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={item.value}
            >
              <span>{item.value}</span>
              {showControls && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = linkItems.filter(x => x.id !== item.id).map(x => ({ id: x.id, value: x.value }));
                    onUpdate(updated);
                  }}
                  style={{
                    cursor: 'pointer',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    lineHeight: 1,
                    padding: '0 1px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  title="移除關聯"
                >
                  ×
                </span>
              )}
            </span>
          ))}

          {hiddenLinkCount > 0 && (
            <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, flexShrink: 0 }} title={`另有 ${hiddenLinkCount} 筆關聯`}>
              +{hiddenLinkCount}
            </span>
          )}

          {showControls && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 8px',
                background: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 0.15s, color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
              title="新增關聯"
            >
              +
            </span>
          )}
        </div>
      );
    }

    if (field.type === 'long_text') {
      const textStr = value !== null && value !== undefined ? String(value) : '';
      const firstLine = textStr.split('\n')[0];
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 8px', overflow: 'hidden', gap: '4px' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontSize: '13px', color: '#1e293b', lineHeight: '1.4' }}>
            {firstLine}
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
                cursor: 'pointer', flexShrink: 0, color: '#64748b',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 8px', width: '100%' }}>
          {[1, 2, 3, 4, 5].map((starNum) => (
            <span
              key={starNum}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(starNum === ratingVal ? 0 : starNum);
              }}
              style={{ cursor: 'pointer', color: starNum <= ratingVal ? '#f59e0b' : '#cbd5e1', fontSize: '15px' }}
            >
              ★
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
            style={{ color: '#2563eb', textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}
          >
            🔗 {urlStr}
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
            style={{ color: '#2563eb', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}
          >
            ✉️ {emailStr}
          </a>
        </div>
      );
    }

    if (field.type === 'phone') {
      const phoneStr = value != null ? String(value).trim() : '';
      if (!phoneStr) return null;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%' }}>
          <a
            href={`tel:${phoneStr}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#0f172a', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}
          >
            📞 {phoneStr}
          </a>
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
      return (
        <span style={{ width: '100%', padding: '0 8px', textAlign: 'right', fontSize: '13px', color: '#1e293b', fontFamily: 'monospace' }}>
          {value !== null && value !== undefined && value !== '' ? Number(value).toLocaleString() : ''}
        </span>
      );
    }

    if (field.type === 'created_on' || field.type === 'last_modified_on') {
      const dStr = value ? formatDateValue(value) : '';
      if (!dStr) return null;
      return (
        <span style={{ padding: '0 8px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          🕒 {dStr}
        </span>
      );
    }

    if (field.type === 'created_by' || field.type === 'last_modified_by') {
      return (
        <span style={{ padding: '0 8px', fontSize: '12px', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
              border: isChecked ? '1px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: isChecked ? '#2563eb' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              boxShadow: isChecked ? '0 1px 2px rgba(37, 99, 235, 0.2)' : 'none'
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

    if (field.type === 'formula' || field.type === 'lookup' || field.type === 'rollup') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%', background: 'rgba(248, 250, 252, 0.6)', height: '100%' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ƒ</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', color: '#334155' }}>
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
        <span style={{ padding: '0 8px', fontSize: '11px', color: '#64748b', fontFamily: 'monospace', background: '#f1f5f9', borderRadius: '4px', margin: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {uuidStr}
        </span>
      );
    }

    if (field.type === 'duration') {
      const durVal = value != null ? String(value) : '';
      if (!durVal) return null;
      return (
        <span style={{ padding: '0 8px', fontSize: '13px', color: '#334155', fontFamily: 'monospace' }}>
          ⏱️ {durVal}
        </span>
      );
    }

    if (field.type === 'edit_row_link') {
      if (!isCellHovered) return null;
      return (
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}>
          <span style={{ padding: '2px 8px', fontSize: '12px', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px' }}>
            Expand row ↗
          </span>
        </div>
      );
    }

    if (field.type === 'ai_prompt') {
      const aiStr = value != null ? String(value) : '';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', overflow: 'hidden', width: '100%' }}>
          <span style={{ fontSize: '12px', color: '#8b5cf6' }}>✨</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', color: '#4c1d95' }}>
            {aiStr || 'Generative AI Prompt'}
          </span>
        </div>
      );
    }

    if (field.type === 'date') {
      const dateDisplay = formatDateValue(value);
      return (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', padding: '0 8px', fontSize: '13px', color: '#1e293b' }}>
          {dateDisplay}
        </span>
      );
    }

    return (
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', padding: '0 8px', fontSize: '13px', color: '#1e293b' }}>
        {value !== null && value !== undefined ? String(value) : ''}
      </span>
    );
  };

  const cellWidth = field.width || 180;

  let cellBg: string | undefined = undefined;

  if (isInRange) {
    cellBg = 'rgba(37, 99, 235, 0.12)';
  } else if (isRowSelected) {
    cellBg = isCellHovered ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)';
  } else if (isSelected) {
    cellBg = 'rgba(37, 99, 235, 0.04)';
  }

  let cellShadow: string | undefined = undefined;
  if (isEditing) {
    cellShadow = undefined;
  } else if (isSelected && !isInRange) {
    // Single selected cell focus outline
    cellShadow = 'inset 0 0 0 2px #2563eb';
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

  return (
    <div
      ref={cellRef}
      onMouseDown={(e) => {
        if (!isEditing && e.button === 0) {
          onSelect(e);
        }
      }}
      onMouseEnter={() => {
        setIsCellHovered(true);
        if (!isEditing) {
          onMouseEnterCell?.();
        }
      }}
      onDoubleClick={() => {
        if (field.type === 'boolean') {
          const isChecked = Boolean(value === true || value === 'true' || value === 1 || value === '1');
          onUpdate(!isChecked);
        } else if (!['formula', 'lookup', 'rollup', 'count', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'autonumber'].includes(field.type)) {
          onStartEdit();
        }
      }}
      style={{ 
        width: `var(--field-width-${field.id}, ${cellWidth}px)`,
        position: isPrimary ? 'sticky' : 'relative',
        left: isPrimary ? `${rowDetailsWidth}px` : undefined,
        boxShadow: finalBoxShadow,
        borderRight: isPrimary ? '2px solid var(--border-color, #cbd5e1)' : undefined,
        background: cellBg ? `linear-gradient(${cellBg}, ${cellBg}), ${rowColorBg || '#ffffff'}` : (rowColorBg || '#ffffff'),
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        height: 'var(--row-height, 32px)',
        overflow: 'hidden',
        userSelect: 'none',
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
          style={{ position: 'absolute', right: '-1px', bottom: '-1px', width: '6px', height: '6px', backgroundColor: '#2563eb', cursor: 'crosshair', zIndex: 20 }}
        />
      )}
    </div>
  );
};
