'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TableField } from '@/modules/database/types';

const getOptionColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const bg = `hsl(${hue}, 80%, 93%)`;
  const text = `hsl(${hue}, 80%, 30%)`;
  return {
    backgroundColor: bg,
    color: text,
    bg,
    text
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
  rangeEdges?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  onSelect: (e?: React.MouseEvent) => void;
  onMouseEnterCell?: () => void;
  onStartAutofill?: (e: React.MouseEvent) => void;
  onStartEdit: () => void;
  onUpdate: (val: any) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onCancelEdit: () => void;
}

export const GridViewCell: React.FC<GridViewCellProps> = ({
  field,
  value,
  isSelected,
  isEditing,
  isInRange,
  rangeEdges,
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

  // State for Combobox (single/multi select)
  const [comboSearch, setComboSearch] = useState('');

  const renderCellContent = () => {
    if (isEditing) {
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

      const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';

      return (
        <input
          ref={inputRef}
          type={inputType}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
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
        return (
          <div style={{ display: 'flex', gap: '4px', padding: '0 8px', overflow: 'hidden', alignItems: 'center', height: '100%', flexWrap: 'wrap' }}>
            {items.map((itemStr, i) => {
              const { bg, text } = getOptionColor(itemStr);
              return (
                <span key={i} style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {itemStr}
                </span>
              );
            })}
          </div>
        );
      }
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
  } else if (isSelected) {
    cellBg = 'rgba(37, 99, 235, 0.04)';
  }

  let cellShadow: string | undefined = undefined;
  if (isEditing) {
    cellShadow = undefined;
  } else if (isInRange && rangeEdges) {
    const shadows: string[] = [];
    if (rangeEdges.top) shadows.push('inset 0 2px 0 0 #2563eb');
    if (rangeEdges.bottom) shadows.push('inset 0 -2px 0 0 #2563eb');
    if (rangeEdges.left) shadows.push('inset 2px 0 0 0 #2563eb');
    if (rangeEdges.right) shadows.push('inset -2px 0 0 0 #2563eb');
    cellShadow = shadows.join(', ') || undefined;
  } else if (isSelected) {
    cellShadow = 'inset 0 0 0 2px #2563eb';
  }

  return (
    <div
      onMouseDown={(e) => {
        if (!isEditing && e.button === 0) {
          onSelect(e);
        }
      }}
      onMouseEnter={() => {
        if (!isEditing) {
          onMouseEnterCell?.();
        }
      }}
      onDoubleClick={onStartEdit}
      style={{ 
        width: `var(--field-width-${field.id}, ${cellWidth}px)`,
        position: 'relative',
        boxShadow: cellShadow,
        backgroundColor: cellBg,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        height: 'var(--row-height, 32px)',
        userSelect: 'none',
        zIndex: isEditing ? 100 : (isSelected || isInRange ? 10 : undefined)
      }}
      className={`grid-view__column ${isSelected || isInRange ? 'active' : ''}`}
    >
      {renderCellContent()}

      {/* Baserow Autofill handle square at bottom right of selected cell */}
      {isSelected && !isEditing && (
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
