'use client';

import React, { useEffect, useRef } from 'react';
import { Copy, Scissors, Clipboard, Eraser, Trash2 } from 'lucide-react';

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
  const menuRef = useRef<HTMLDivElement>(null);

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

  const adjustedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 220);
  const adjustedY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
        width: '220px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
        zIndex: 999999,
        padding: '6px 0',
        fontSize: '13px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1e293b'
      }}
    >
      {/* Header */}
      <div style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
        已選取 {selectedCellCount} 個儲存格 ({selectedRowCount} 列)
      </div>

      {/* Copy */}
      <div
        onClick={() => { onCopy(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', cursor: 'pointer', color: '#334155' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Copy style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <span>複製 (Copy)</span>
        </div>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ctrl+C</span>
      </div>

      {/* Cut */}
      <div
        onClick={() => { onCut(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', cursor: 'pointer', color: '#334155' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Scissors style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <span>剪下 (Cut)</span>
        </div>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ctrl+X</span>
      </div>

      {/* Paste */}
      <div
        onClick={() => { onPaste(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', cursor: 'pointer', color: '#334155' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clipboard style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <span>貼上 (Paste)</span>
        </div>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ctrl+V</span>
      </div>

      {/* Clear Values */}
      <div
        onClick={() => { onClearValues(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', cursor: 'pointer', color: '#334155' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Eraser style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <span>清除內容</span>
        </div>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Del</span>
      </div>

      {/* Separator */}
      <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

      {/* Delete Selected Rows */}
      <div
        onClick={() => { onDeleteRows(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 14px', cursor: 'pointer', color: '#ef4444' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Trash2 style={{ width: '15px', height: '15px', color: '#ef4444' }} />
        <span>刪除選取的資料列 ({selectedRowCount})</span>
      </div>
    </div>
  );
};
