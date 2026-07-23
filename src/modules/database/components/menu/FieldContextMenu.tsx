'use client';

import React, { useEffect, useRef } from 'react';
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

  // Ensure menu stays within window bounds
  const adjustedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 250);
  const adjustedY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 520);

  const menuItems = [
    {
      label: 'Edit field',
      icon: Pencil,
      onClick: () => { onEditField(field); onClose(); }
    },
    {
      label: 'Change primary field',
      icon: RefreshCcw,
      onClick: () => { onChangePrimaryField?.(field); onClose(); }
    },
    {
      label: 'Configure date dependencies',
      icon: Calendar,
      onClick: () => { onConfigureDateDependencies?.(field); onClose(); }
    },
    {
      label: 'Edit field permissions',
      icon: Lock,
      onClick: () => { onEditPermissions?.(field); onClose(); }
    },
    {
      label: 'Insert left',
      icon: ArrowLeft,
      onClick: () => { onInsertLeft(field); onClose(); }
    },
    {
      label: 'Insert right',
      icon: ArrowRight,
      onClick: () => { onInsertRight(field); onClose(); }
    },
    {
      label: 'Duplicate field',
      icon: Copy,
      onClick: () => { onDuplicateField(field); onClose(); }
    },
    {
      label: 'Create filter',
      icon: Filter,
      onClick: () => { onCreateFilter(field); onClose(); }
    },
    {
      label: 'Sort A → Z',
      icon: ArrowDownAZ,
      onClick: () => { onSortAsc(field); onClose(); }
    },
    {
      label: 'Sort Z → A',
      icon: ArrowUpAZ,
      onClick: () => { onSortDesc(field); onClose(); }
    },
    {
      label: 'Group by',
      icon: Layers,
      onClick: () => { onGroupBy(field); onClose(); }
    },
    {
      label: 'Hide field',
      icon: EyeOff,
      onClick: () => { onHideField(field); onClose(); }
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${adjustedY}px`,
        left: `${adjustedX}px`,
        width: '240px',
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
      {/* Title */}
      <div style={{ padding: '8px 16px 6px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
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
              gap: '12px',
              padding: '7px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 450,
              color: '#334155',
              transition: 'background-color 0.1s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Icon style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
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
          gap: '12px',
          padding: '7px 16px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 450,
          color: '#ef4444',
          transition: 'background-color 0.1s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Trash2 style={{ width: '15px', height: '15px', color: '#ef4444', flexShrink: 0 }} />
        <span>Delete field</span>
      </div>
    </div>
  );
};
