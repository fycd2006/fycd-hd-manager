'use client';

import React from 'react';
import { Copy, Scissors, Clipboard, Eraser, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18nContext';
import FloatingMenuContainer from '@/components/ui/FloatingMenuContainer';

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

  return (
    <FloatingMenuContainer x={x} y={y} onClose={onClose} width={230}>
      {/* Header */}
      <div style={{ padding: '8px 10px 6px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
        {t('multiCell.selectedInfo', { cells: selectedCellCount, rows: selectedRowCount })}
      </div>

      {/* Copy */}
      <div
        onClick={() => { onCopy(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', transition: 'all 0.15s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
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
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
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
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
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
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
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
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Trash2 style={{ width: '15px', height: '15px', color: '#ef4444', strokeWidth: 1.75 }} />
        <span>{t('multiCell.deleteRows', { rows: selectedRowCount })}</span>
      </div>
    </FloatingMenuContainer>
  );
};
