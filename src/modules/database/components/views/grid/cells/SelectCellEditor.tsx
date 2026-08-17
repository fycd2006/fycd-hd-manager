import React, { useState, useRef, useEffect } from 'react';
import PopoverPortal from '@/components/ui/PopoverPortal';
import { getOptionColor, BASEROW_PALETTE } from './utils';

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

interface SelectCellEditorProps {
  value: string;
  fieldId: number;
  isMultiple: boolean;
  options: SelectOption[];
  popoverPos: { top: number; left: number; width: number } | null;
  onUpdate: (val: string) => void;
  onUpdateField?: (fieldId: number, updates: any) => void;
  onCancelEdit: () => void;
}

export const SelectCellEditor: React.FC<SelectCellEditorProps> = ({
  value,
  fieldId,
  isMultiple,
  options,
  popoverPos,
  onUpdate,
  onUpdateField,
  onCancelEdit
}) => {
  const [localVal, setLocalVal] = useState(value || '');
  const [comboSearch, setComboSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isUuidPattern = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
    /^[0-9a-f]{24,}$/i.test(s.trim())

  const safeOptions = (Array.isArray(options) ? options : [])
    .map((opt, idx) => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          id: String(opt.id ?? opt.value ?? opt.name ?? `opt_${idx}`),
          name: String(opt.name ?? opt.label ?? opt.text ?? opt.value ?? opt.id ?? ''),
          color: opt.color || BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg
        }
      }
      const str = String(opt).trim()
      return { id: `opt_${idx}`, name: str, color: BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg }
    })
    .filter((opt) => opt.name.length > 0 && !isUuidPattern(opt.name))

  const filteredOptions = safeOptions.filter((opt) => {
    return (opt.name || '').toLowerCase().includes(comboSearch.toLowerCase())
  })
  
  const isExactMatch = safeOptions.some((opt) => {
    return (opt.name || '').toLowerCase() === comboSearch.toLowerCase()
  })

  let currentItems: string[] = [];
  if (isMultiple) {
    try { 
      currentItems = JSON.parse(localVal); 
      if (!Array.isArray(currentItems)) currentItems = [String(localVal)]; 
    } catch { 
      currentItems = String(localVal ?? '').split(',').map((s: string) => s.trim()).filter(Boolean); 
    }
  }

  const searchAlreadySelected = isMultiple && currentItems.some((item) => {
    const opt = safeOptions.find((o) => o.id === item || o.name === item)
    const name = opt ? opt.name : item
    return name.toLowerCase() === comboSearch.toLowerCase()
  })

  const handleCreateNewOption = () => {
    if (!onUpdateField) return null
    const trimmed = comboSearch.trim()
    if (!trimmed || isUuidPattern(trimmed)) return null
    const newId = 'opt_' + Math.random().toString(36).substr(2, 9)
    const newColor = BASEROW_PALETTE[safeOptions.length % BASEROW_PALETTE.length].bg
    const newOpt = { id: newId, name: trimmed, color: newColor }
    const newOptions = [...safeOptions, newOpt]
    
    onUpdateField(fieldId, { options: { choices: newOptions } })
    return trimmed
  }

  if (!isMultiple) {
    const selectedOpt = safeOptions.find(o => o.id === localVal || o.name === localVal);
    const displayStr = selectedOpt ? selectedOpt.name : localVal;

    return (
      <>
        <div 
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancelEdit();
            if (e.key === 'Enter' && comboSearch) {
                let finalVal = comboSearch;
                if (!isExactMatch && onUpdateField) {
                  const newId = handleCreateNewOption();
                  if (newId) finalVal = newId;
                } else if (isExactMatch) {
                  const exactOpt = safeOptions.find(o => o.name.toLowerCase() === comboSearch.toLowerCase());
                  if (exactOpt) finalVal = exactOpt.id;
                }
                setLocalVal(finalVal);
                onUpdate(finalVal);
                onCancelEdit();
            }
          }}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
            background: '#fff', boxShadow: 'inset 0 0 0 2px #3F6212', 
            zIndex: 9999, display: 'flex', outline: 'none', boxSizing: 'border-box',
            alignItems: 'center', padding: '0 8px'
          }}
        >
          {localVal ? (
            <span style={{ ...getOptionColor(localVal, safeOptions), padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {displayStr}
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
              ref={inputRef}
              autoFocus
              type="text"
              value={comboSearch}
              onChange={(e) => setComboSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onCancelEdit();
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!comboSearch.trim()) return;
                  let val = comboSearch.trim();
                  if (!isExactMatch && onUpdateField) {
                    const newId = handleCreateNewOption();
                    if (newId) val = newId;
                  } else if (isExactMatch) {
                    const exactOpt = safeOptions.find(o => o.name.toLowerCase() === val.toLowerCase());
                    if (exactOpt) val = exactOpt.id;
                  }
                  setLocalVal(val);
                  onUpdate(val);
                  onCancelEdit();
                }
              }}
              placeholder="搜尋或輸入新增..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', marginLeft: '8px', fontSize: '13px' }}
            />
          </div>
          <div style={{ overflowY: 'auto', padding: '4px 0', flex: 1 }}>
            {filteredOptions.map((opt, i) => {
              const optId = typeof opt === 'string' ? opt : opt.id;
              const optName = typeof opt === 'string' ? opt : opt.name;
              const { bg, text } = getOptionColor(optId, safeOptions);
              const isSelected = localVal === optId || localVal === optName;
              return (
                <div 
                  key={i} 
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetVal = optName || optId;
                    setLocalVal(targetVal);
                    onUpdate(targetVal);
                    onCancelEdit();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetVal = optName || optId;
                    setLocalVal(targetVal);
                    onUpdate(targetVal);
                    onCancelEdit();
                  }}
                  style={{ padding: '6px 12px', cursor: 'pointer', background: isSelected ? '#f1f5f9' : 'transparent', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#f1f5f9' : 'transparent'}
                >
                  <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px' }}>
                    {optName}
                  </span>
                </div>
              );
            })}
            {comboSearch && !isExactMatch && (
              <div 
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  let val = comboSearch;
                  if (onUpdateField) {
                    const newId = handleCreateNewOption();
                    if (newId) val = newId;
                  }
                  setLocalVal(val);
                  onUpdate(val);
                  onCancelEdit();
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

  // Multiple Select
  return (
    <>
      <div 
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancelEdit();
          if (e.key === 'Enter' && comboSearch && !searchAlreadySelected) {
              let valId = comboSearch;
              if (!isExactMatch && onUpdateField) {
                const newId = handleCreateNewOption();
                if (newId) valId = newId;
              } else if (isExactMatch) {
                const exactOpt = safeOptions.find(o => o.name.toLowerCase() === comboSearch.toLowerCase());
                if (exactOpt) valId = exactOpt.id;
              }
              const nextItems = [...currentItems, valId];
              const nextVal = JSON.stringify(nextItems);
              setLocalVal(nextVal);
              onUpdate(nextVal);
              setComboSearch('');
              e.preventDefault();
          }
        }}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', minHeight: '100%', 
          background: '#fff', boxShadow: 'inset 0 0 0 2px #3F6212', 
          zIndex: 9999, display: 'flex', outline: 'none', boxSizing: 'border-box',
          flexWrap: 'wrap', gap: '4px', padding: '4px 8px', alignItems: 'center'
        }}
      >
        {currentItems.map((item, i) => {
          const selectedOpt = safeOptions.find(o => o.id === item || o.name === item);
          const displayStr = selectedOpt ? selectedOpt.name : item;
          const { bg, text } = getOptionColor(item, safeOptions);
          return (
            <span key={i} style={{ background: bg, color: text, padding: '2px 6px', borderRadius: '9999px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
              {displayStr}
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
            ref={inputRef}
            autoFocus
            type="text"
            value={comboSearch}
            onChange={(e) => setComboSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onCancelEdit();
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!comboSearch.trim()) return;
                let valId = comboSearch.trim();
                if (!isExactMatch && onUpdateField) {
                  const newId = handleCreateNewOption();
                  if (newId) valId = newId;
                } else if (isExactMatch) {
                  const exactOpt = safeOptions.find(o => o.name.toLowerCase() === valId.toLowerCase());
                  if (exactOpt) valId = exactOpt.id;
                }
                let nextItems = [...currentItems];
                if (!nextItems.includes(valId)) {
                  nextItems.push(valId);
                }
                const nextVal = JSON.stringify(nextItems);
                setLocalVal(nextVal);
                onUpdate(nextVal);
                setComboSearch('');
              }
            }}
            placeholder="搜尋或輸入新增..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', marginLeft: '8px', fontSize: '13px' }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 0', flex: 1 }}>
          {filteredOptions.map((opt, i) => {
            const optId = typeof opt === 'string' ? opt : opt.id;
            const optName = typeof opt === 'string' ? opt : opt.name;
            const isSelected = currentItems.includes(optId) || currentItems.includes(optName);
            const { bg, text } = getOptionColor(optId, safeOptions);
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
                  // If it's selected by name (old format), remove it as well.
                  nextItems = nextItems.filter(item => item !== optId && item !== optName);
                  if (!isSelected) nextItems.push(optName || optId);
                  
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
                  onChange={() => {}} 
                  style={{ margin: 0, cursor: 'pointer', pointerEvents: 'none' }}
                />
                <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: '9999px', fontSize: '12px' }}>
                  {optName}
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
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                let valId = comboSearch;
                if (onUpdateField) {
                  const newId = handleCreateNewOption();
                  if (newId) valId = newId;
                }
                const nextItems = [...currentItems, valId];
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
};
