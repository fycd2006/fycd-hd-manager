'use client';

import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Scissors, Clipboard, Eraser, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18nContext';

interface MultiCellContextMenuProps {
  x: number;
  y: number;
  selectedCellCount: number;
  selectedRowCount: number;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onClearValues: () => void;
  onDeleteRows: () => void;
}

export const MultiCellContextMenu: React.FC<MultiCellContextMenuProps> = ({
  x,
  y,
  selectedCellCount,
  selectedRowCount,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onClearValues,
  onDeleteRows,
}) => {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: y, left: x });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth || 230;
    const menuHeight = menuEl?.offsetHeight || 220;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let left = x + 2;
    let top = y + 2;

    // Flip to left if overflowing right edge
    if (left + menuWidth > winWidth - 10) {
      left = Math.max(10, x - menuWidth - 2);
    }

    // Flip to top if overflowing bottom edge
    if (top + menuHeight > winHeight - 10) {
      top = Math.max(10, y - menuHeight - 2);
    }

    setCoords({ top, left });
  }, [x, y]);

  const menuContent = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: '230px',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 232, 240, 0.85)',
        borderRadius: '12px',
        boxShadow: '0 20px 35px -10px rgba(15, 23, 42, 0.16), 0 8px 15px -6px rgba(15, 23, 42, 0.08)',
        zIndex: 999999,
        padding: '4px',
        fontSize: '13px',
        color: '#1e293b'
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 10px 6px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
        {t('multiCell.selectedInfo', { cells: selectedCellCount, rows: selectedRowCount })}
      </div>

      {/* Copy */}
      <div
        onClick={() => { onCopy(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', transition: 'all 0.15s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Copy style={{ width: '15px', height: '15px', color: '#64748b', strokeWidth: 1.75 }} />
          <span>{t('multiCell.copy')}</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl+C</span>
      </div>

      {/* Cut */}
      <div
        onClick={() => { onCut(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', transition: 'all 0.15s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Scissors style={{ width: '15px', height: '15px', color: '#64748b', strokeWidth: 1.75 }} />
          <span>{t('multiCell.cut')}</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl+X</span>
      </div>

      {/* Paste */}
      <div
        onClick={() => { onPaste(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', transition: 'all 0.15s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clipboard style={{ width: '15px', height: '15px', color: '#64748b', strokeWidth: 1.75 }} />
          <span>{t('multiCell.paste')}</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl+V</span>
      </div>

      {/* Clear Values */}
      <div
        onClick={() => { onClearValues(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', transition: 'all 0.15s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Eraser style={{ width: '15px', height: '15px', color: '#64748b', strokeWidth: 1.75 }} />
          <span>{t('multiCell.clear')}</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>Del</span>
      </div>

      {/* Separator */}
      <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

      {/* Delete Selected Rows */}
      <div
        onClick={() => { onDeleteRows(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', transition: 'all 0.15s ease' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Trash2 style={{ width: '15px', height: '15px', color: '#ef4444', strokeWidth: 1.75 }} />
        <span>{t('multiCell.deleteRows', { rows: selectedRowCount })}</span>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(menuContent, document.body);
};
