import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import ModalOverlay from '@/components/ui/ModalOverlay';
import PopoverPortal from '@/components/ui/PopoverPortal';

interface LongTextCellEditorProps {
  value: string;
  fieldName: string;
  cellWidth: number;
  popoverPos: { top: number; left: number; width: number } | null;
  onUpdate: (val: string) => void;
  onCancelEdit: () => void;
}

export const LongTextCellEditor: React.FC<LongTextCellEditorProps> = ({
  value,
  fieldName,
  cellWidth,
  popoverPos,
  onUpdate,
  onCancelEdit
}) => {
  const [localVal, setLocalVal] = useState(value || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const longTextRef = useRef<HTMLTextAreaElement>(null);
  const longTextDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (longTextDebounceRef.current) clearTimeout(longTextDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (longTextRef.current) {
      const ta = longTextRef.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [isExpanded]);

  const handleLongTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const nextVal = val.substring(0, start) + '\t' + val.substring(end);
      setLocalVal(nextVal);
      onUpdate(nextVal);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 1, start + 1);
      });
    }
    if (e.key === 'Escape') {
      onUpdate(localVal);
      setIsExpanded(false);
      onCancelEdit();
    }
    e.stopPropagation();
  }, [localVal, onUpdate, onCancelEdit]);

  const charCount = localVal.length;
  const wordCount = localVal.trim() ? localVal.trim().split(/\s+/).length : 0;

  if (isExpanded) {
    return (
      <ModalOverlay
        show={true}
        onClose={() => {
          onUpdate(localVal);
          setIsExpanded(false);
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{fieldName}</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => setIsExpanded(false)}
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
            setIsExpanded(true);
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
};
