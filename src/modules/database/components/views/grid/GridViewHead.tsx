'use client';

import React from 'react';
import { 
  Type, 
  AlignLeft,
  Hash, 
  List, 
  Calendar, 
  CheckSquare, 
  Link2, 
  Paperclip, 
  Star, 
  Globe,
  Mail,
  Phone,
  Users,
  Search,
  Columns,
  Calculator,
  Binary,
  Clock,
  UserCheck,
  Plus, 
  ChevronDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { TableField } from '@/modules/database/types';
import { useI18n } from '@/lib/i18n/i18nContext';

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  long_text: AlignLeft,
  number: Hash,
  single_select: List,
  multiple_select: List,
  date: Calendar,
  boolean: CheckSquare,
  link_row: Link2,
  file: Paperclip,
  rating: Star,
  url: Globe,
  email: Mail,
  phone: Phone,
  collaborator: Users,
  lookup: Search,
  rollup: Columns,
  formula: Calculator,
  autonumber: Binary,
  created_on: Clock,
  last_modified_on: Clock,
  created_by: UserCheck,
  last_modified_by: UserCheck,
};

interface GridViewHeadProps {
  fields: TableField[];
  rowDetailsWidth?: number;
  sortField?: string | null;
  sortOrder?: 'asc' | 'desc';
  isAllRowsSelected?: boolean;
  isSomeRowsSelected?: boolean;
  onToggleSelectAllRows?: () => void;
  onAddField?: () => void;
  onFieldClick?: (field: TableField, e: React.MouseEvent) => void;
  onOpenFieldContextMenu?: (field: TableField, x: number, y: number) => void;
  onResizeColumn?: (fieldId: number, newWidth: number) => void;
  onResizeColumnEnd?: (fieldId: number, newWidth: number) => void;
  onReorderFields?: (sourceFieldId: number, targetFieldId: number) => void;
}

export const GridViewHead: React.FC<GridViewHeadProps> = ({
  fields,
  rowDetailsWidth = 56,
  sortField,
  sortOrder,
  isAllRowsSelected = false,
  isSomeRowsSelected = false,
  onToggleSelectAllRows,
  onAddField,
  onFieldClick,
  onOpenFieldContextMenu,
  onResizeColumn,
  onResizeColumnEnd,
  onReorderFields,
}) => {
  const { t } = useI18n();
  const [draggedFieldId, setDraggedFieldId] = React.useState<number | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = React.useState<number | null>(null);
  const [resizingFieldId, setResizingFieldId] = React.useState<number | null>(null);
  const [hoveringResizeFieldId, setHoveringResizeFieldId] = React.useState<number | null>(null);

  return (
    <div className="grid-view__head" style={{ display: 'flex', width: 'max-content', minWidth: '100%', height: '36px', minHeight: '36px', maxHeight: '36px', position: 'relative', boxSizing: 'border-box' }}>
      {/* 1. Row Identifier / Number Header Column (Sticky Frozen Left: 0) */}
      <div
        className="grid-view__column grid-view__column--no-border-right"
        onClick={onToggleSelectAllRows}
        style={{
          width: `${rowDetailsWidth}px`,
          height: '36px',
          position: 'sticky',
          left: 0,
          zIndex: 25,
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#94a3b8',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        title={t('gridHead.selectAllTooltip')}
      >

        <input
          type="checkbox"
          checked={Boolean(isAllRowsSelected)}
          ref={(el) => {
            if (el) el.indeterminate = Boolean(isSomeRowsSelected && !isAllRowsSelected);
          }}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelectAllRows?.();
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ width: '13px', height: '13px', cursor: 'pointer' }}
        />
        <span>#</span>
      </div>

      {/* 2. Field Column Headers */}
      {fields.map((field, fieldIndex) => {
        const IconComponent = FIELD_TYPE_ICONS[field.type] || Type;
        const columnWidth = field.width || 180;
        const isSorted = sortField === `field_${field.id}`;
        const isDraggingThis = draggedFieldId === field.id;
        const isDragTarget = dragOverFieldId === field.id && draggedFieldId !== field.id;
        const isPrimary = fieldIndex === 0;
        const isHoveringResize = hoveringResizeFieldId === field.id;
        const isResizingThis = resizingFieldId === field.id;

        return (
          <div
            key={field.id}
            className="grid-view__column grid-view__column--field"
            draggable={!isHoveringResize && !isResizingThis}
            onDragStart={(e) => {
              if (isHoveringResize || isResizingThis) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.setData('text/plain', String(field.id));
              e.dataTransfer.effectAllowed = 'move';
              setDraggedFieldId(field.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverFieldId !== field.id) {
                setDragOverFieldId(field.id);
              }
            }}
            onDragLeave={() => {
              if (dragOverFieldId === field.id) {
                setDragOverFieldId(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverFieldId(null);
              setDraggedFieldId(null);
              if (draggedFieldId && draggedFieldId !== field.id) {
                onReorderFields?.(draggedFieldId, field.id);
              }
            }}
            onDragEnd={() => {
              setDraggedFieldId(null);
              setDragOverFieldId(null);
            }}
            style={{
              width: `var(--field-width-${field.id}, ${columnWidth}px)`,
              height: '36px',
              position: isPrimary ? 'sticky' : 'relative',
              left: isPrimary ? `${rowDetailsWidth}px` : undefined,
              zIndex: isPrimary ? 24 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              cursor: isHoveringResize || isResizingThis ? 'col-resize' : 'grab',
              backgroundColor: isDraggingThis ? '#e0f2fe' : 'var(--bg-secondary, #ffffff)',
              opacity: isDraggingThis ? 0.6 : 1,
              boxShadow: isPrimary ? '2px 0 5px -2px rgba(0, 0, 0, 0.12)' : (isDragTarget ? 'inset 3px 0 0 0 #3F6212' : undefined),
              borderRight: isPrimary ? '2px solid var(--border-color, #cbd5e1)' : '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0',
              boxSizing: 'border-box',
              transition: 'background-color 0.15s, box-shadow 0.15s',
            }}

            onClick={(e) => {
              e.stopPropagation();
              onOpenFieldContextMenu?.(field, e.clientX, e.clientY);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onOpenFieldContextMenu?.(field, e.clientX, e.clientY);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1, pointerEvents: 'none' }}>
              <IconComponent style={{ width: '14px', height: '14px', color: isSorted ? '#3F6212' : '#64748b', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: isSorted ? 600 : 500, color: isSorted ? '#3F6212' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {field.name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {isSorted && (
                sortOrder === 'asc' 
                  ? <ArrowUp style={{ width: '12px', height: '12px', color: '#18181B', flexShrink: 0 }} /> 
                  : <ArrowDown style={{ width: '12px', height: '12px', color: '#18181B', flexShrink: 0 }} />
              )}
              <ChevronDown 
                style={{ width: '12px', height: '12px', color: '#94a3b8', flexShrink: 0, marginLeft: '2px', cursor: 'pointer' }} 
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenFieldContextMenu?.(field, rect.left, rect.bottom + 4);
                }}
              />
            </div>

            {/* Baserow Style Column Resize Handle with Blue Accent Pill */}
            <div
              className="grid-view__column-resize-handle"
              style={{
                position: 'absolute',
                right: '-8px',
                top: 0,
                bottom: 0,
                width: '16px',
                cursor: 'col-resize',
                zIndex: 35,
                touchAction: 'none',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={() => setHoveringResizeFieldId(field.id)}
              onMouseLeave={() => {
                if (resizingFieldId !== field.id) {
                  setHoveringResizeFieldId(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setResizingFieldId(field.id);
                setHoveringResizeFieldId(field.id);

                const startX = e.clientX;
                const startWidth = columnWidth;

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                const onMouseMove = (moveEvent: MouseEvent) => {
                  moveEvent.preventDefault();
                  const delta = moveEvent.clientX - startX;
                  const newWidth = Math.max(70, startWidth + delta);
                  onResizeColumn?.(field.id, newWidth);
                };

                const onMouseUp = (upEvent: MouseEvent) => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                  
                  const finalWidth = Math.max(70, startWidth + (upEvent.clientX - startX));
                  onResizeColumnEnd?.(field.id, finalWidth);

                  setResizingFieldId(null);
                  setHoveringResizeFieldId(null);

                  document.body.style.cursor = '';
                  document.body.style.userSelect = '';
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (!e.touches || e.touches.length === 0) return;
                setResizingFieldId(field.id);
                setHoveringResizeFieldId(field.id);

                const startX = e.touches[0].clientX;
                const startWidth = columnWidth;

                const onTouchMove = (moveEvent: TouchEvent) => {
                  if (!moveEvent.touches || moveEvent.touches.length === 0) return;
                  const moveX = moveEvent.touches[0].clientX;
                  const delta = moveX - startX;
                  const newWidth = Math.max(70, startWidth + delta);
                  onResizeColumn?.(field.id, newWidth);
                };

                const onTouchEnd = (endEvent: TouchEvent) => {
                  window.removeEventListener('touchmove', onTouchMove);
                  window.removeEventListener('touchend', onTouchEnd);
                  
                  const lastTouch = endEvent.changedTouches?.[0];
                  const finalX = lastTouch ? lastTouch.clientX : startX;
                  const finalWidth = Math.max(70, startWidth + (finalX - startX));
                  onResizeColumnEnd?.(field.id, finalWidth);

                  setResizingFieldId(null);
                  setHoveringResizeFieldId(null);
                };

                window.addEventListener('touchmove', onTouchMove, { passive: false });
                window.addEventListener('touchend', onTouchEnd);
              }}
            >
              {/* Baserow Blue Accent Pill Indicator on Hover/Drag */}
              <div
                style={{
                  width: (isHoveringResize || isResizingThis) ? '4px' : '2px',
                  height: (isHoveringResize || isResizingThis) ? '24px' : '100%',
                  borderRadius: (isHoveringResize || isResizingThis) ? '4px' : '0px',
                  backgroundColor: (isHoveringResize || isResizingThis) ? '#3F6212' : 'transparent',
                  boxShadow: (isHoveringResize || isResizingThis) ? '0 0 8px rgba(63, 98, 18, 0.6)' : 'none',
                  transition: 'all 0.15s ease',
                  pointerEvents: 'none'
                }}
              />
            </div>
          </div>
        );
      })}

      {/* 3. Add Field Column */}
      <div
        className="grid-view__column grid-view__add-field"
        style={{
          width: '40px',
          minWidth: '40px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          borderRight: '1px solid var(--border-color, #cbd5e1)',
          borderBottom: '1px solid var(--border-color, #cbd5e1)',
          boxSizing: 'border-box',
          background: '#f8fafc',
          transition: 'background 0.15s ease'
        }}
        onClick={onAddField}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
        title={t('gridHead.addFieldTooltip')}
      >
        <Plus style={{ width: '15px', height: '15px', color: '#64748b' }} />
      </div>
    </div>
  );
};
