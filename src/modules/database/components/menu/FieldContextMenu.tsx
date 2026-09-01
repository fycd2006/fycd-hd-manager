'use client';

import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil,
  RefreshCcw,
  Calendar,
  Lock,
  ArrowLeft,
  ArrowRight,
  Copy,
  Filter,
  ArrowDownAZ,
  ArrowUpAZ,
  Layers,
  EyeOff,
  Trash2
} from 'lucide-react';
import { TableField } from '@/modules/database/types';
import { useI18n } from '@/lib/i18n/i18nContext';

interface FieldContextMenuProps {
  field: TableField;
  x: number;
  y: number;
  onClose: () => void;
  onEditField: (field: TableField) => void;
  onChangePrimaryField?: (field: TableField) => void;
  onConfigureDateDependencies?: (field: TableField) => void;
  onEditPermissions?: (field: TableField) => void;
  onInsertLeft: (field: TableField) => void;
  onInsertRight: (field: TableField) => void;
  onDuplicateField: (field: TableField) => void;
  onCreateFilter: (field: TableField) => void;
  onSortAsc: (field: TableField) => void;
  onSortDesc: (field: TableField) => void;
  onGroupBy: (field: TableField) => void;
  onHideField: (field: TableField) => void;
  onDeleteField: (field: TableField) => void;
}

export const FieldContextMenu: React.FC<FieldContextMenuProps> = ({
  field,
  x,
  y,
  onClose,
  onEditField,
  onChangePrimaryField,
  onConfigureDateDependencies,
  onEditPermissions,
  onInsertLeft,
  onInsertRight,
  onDuplicateField,
  onCreateFilter,
  onSortAsc,
  onSortDesc,
  onGroupBy,
  onHideField,
  onDeleteField,
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
    const menuWidth = menuEl?.offsetWidth || 240;
    const menuHeight = menuEl?.offsetHeight || 480;
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

  const menuItems = [
    {
      label: t('contextMenu.editField'),
      icon: Pencil,
      onClick: () => { onEditField(field); onClose(); }
    },
    {
      label: t('contextMenu.changePrimaryField'),
      icon: RefreshCcw,
      onClick: () => { onChangePrimaryField?.(field); onClose(); }
    },
    {
      label: t('contextMenu.configureDateDependencies'),
      icon: Calendar,
      onClick: () => { onConfigureDateDependencies?.(field); onClose(); }
    },
    {
      label: t('contextMenu.editFieldPermissions'),
      icon: Lock,
      onClick: () => { onEditPermissions?.(field); onClose(); }
    },
    {
      label: t('contextMenu.insertLeft'),
      icon: ArrowLeft,
      onClick: () => { onInsertLeft(field); onClose(); }
    },
    {
      label: t('contextMenu.insertRight'),
      icon: ArrowRight,
      onClick: () => { onInsertRight(field); onClose(); }
    },
    {
      label: t('contextMenu.duplicateField'),
      icon: Copy,
      onClick: () => { onDuplicateField(field); onClose(); }
    },
    {
      label: t('contextMenu.createFilter'),
      icon: Filter,
      onClick: () => { onCreateFilter(field); onClose(); }
    },
    {
      label: t('contextMenu.sortAsc'),
      icon: ArrowDownAZ,
      onClick: () => { onSortAsc(field); onClose(); }
    },
    {
      label: t('contextMenu.sortDesc'),
      icon: ArrowUpAZ,
      onClick: () => { onSortDesc(field); onClose(); }
    },
    {
      label: t('contextMenu.groupBy'),
      icon: Layers,
      onClick: () => { onGroupBy(field); onClose(); }
    },
    {
      label: t('contextMenu.hideField'),
      icon: EyeOff,
      onClick: () => { onHideField(field); onClose(); }
    },
  ];

  const menuContent = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: '240px',
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
      {/* Title Header */}
      <div style={{ padding: '8px 12px 6px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
        {field.name} ({field.id})
      </div>

      {/* Main Items */}
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={index}
            onClick={item.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              color: '#334155',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#334155';
            }}
          >
            <Icon style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0, strokeWidth: 1.75 }} />
            <span>{item.label}</span>
          </div>
        );
      })}

      {/* Separator */}
      <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

      {/* Delete Field */}
      <div
        onClick={() => { onDeleteField(field); onClose(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 10px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          color: '#ef4444',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Trash2 style={{ width: '15px', height: '15px', color: '#ef4444', flexShrink: 0, strokeWidth: 1.75 }} />
        <span>{t('contextMenu.deleteField')}</span>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(menuContent, document.body);
};
