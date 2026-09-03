'use client';

import React from 'react';
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
import FloatingMenuContainer from '@/components/ui/FloatingMenuContainer';

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

  const menuItems = [
    {
      label: t('contextMenu.editField'),
      icon: Pencil,
      onClick: () => { onEditField(field); onClose(); }
    },
    ...(onChangePrimaryField ? [{
      label: t('contextMenu.changePrimaryField'),
      icon: RefreshCcw,
      onClick: () => { onChangePrimaryField(field); onClose(); }
    }] : []),
    ...(onConfigureDateDependencies && (field.type === 'date' || field.type === 'created_on' || field.type === 'last_modified_on') ? [{
      label: t('contextMenu.configureDateDependencies'),
      icon: Calendar,
      onClick: () => { onConfigureDateDependencies(field); onClose(); }
    }] : []),
    ...(onEditPermissions ? [{
      label: t('contextMenu.editFieldPermissions'),
      icon: Lock,
      onClick: () => { onEditPermissions(field); onClose(); }
    }] : []),
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

  return (
    <FloatingMenuContainer x={x} y={y} onClose={onClose} width={240}>
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
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Trash2 style={{ width: '15px', height: '15px', color: '#ef4444', flexShrink: 0, strokeWidth: 1.75 }} />
        <span>{t('contextMenu.deleteField')}</span>
      </div>
    </FloatingMenuContainer>
  );
};
