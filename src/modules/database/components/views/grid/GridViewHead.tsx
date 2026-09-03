'use client';

import React from 'react';
import { 
  Type, 
  AlignLeft,
  Hash, 
  List, 
  Calendar, 
  CheckSquare, 
  CheckCircle,
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
  single_select: CheckCircle,
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
  onAddFieldPopover?: (position: { top: number; left: number }) => void;
  onFieldClick?: (field: TableField, e: React.MouseEvent) => void;
  onSelectColumn?: (fieldIndex: number) => void;
  onOpenFieldContextMenu?: (field: TableField, x: number, y: number) => void;
  onResizeColumn?: (fieldId: number, newWidth: number) => void;
  onResizeColumnEnd?: (fieldId: number, newWidth: number) => void;
  onAutoFitColumn?: (fieldId: number) => void;
  onReorderFields?: (sourceFieldId: number, targetFieldId: number) => void;
  totalTableWidth?: number;
}

const GridViewHeadInner: React.FC<GridViewHeadProps> = ({
  fields,
  rowDetailsWidth = 56,
  sortField,
  sortOrder,
  isAllRowsSelected = false,
  isSomeRowsSelected = false,
  onToggleSelectAllRows,
  onAddField,
  onAddFieldPopover,
  onSelectColumn,
  onOpenFieldContextMenu,
  onResizeColumn,
  onResizeColumnEnd,
  onAutoFitColumn,
  onReorderFields,
  totalTableWidth,
}) => {
  const { t } = useI18n();
  const [draggedFieldId, setDraggedFieldId] = React.useState<number | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = React.useState<number | null>(null);
  const [resizingFieldId, setResizingFieldId] = React.useState<number | null>(null);
  const [hoveringResizeFieldId, setHoveringResizeFieldId] = React.useState<number | null>(null);

  const headWidth = totalTableWidth ?? (fields.reduce((sum, f) => sum + (f.width || 180), rowDetailsWidth) + 200);

  return (
    <div 
      className="grid-view__head" 
      style={{ 
        display: 'flex', 
        width: `${headWidth}px`, 
        minWidth: '100%', 
        height: '36px', 
        minHeight: '36px', 
        maxHeight: '36px', 
        position: 'relative', 
        boxSizing: 'border-box',
        background: '#ffffff',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
      }}
    >
      {/* 1. Row Identifier / Number Header Column (Sticky Frozen Left: 0) */}
      <div
        className="grid-view__column grid-view__column--no-border-right"
        onClick={onToggleSelectAllRows}
        style={{
          width: `${rowDetailsWidth}px`,
          minWidth: `${rowDetailsWidth}px`,
          maxWidth: `${rowDetailsWidth}px`,
          flexShrink: 0,
          height: '100%',
          position: 'sticky',
          left: 0,
          zIndex: 25,
          backgroundColor: '#f8fafc',
          borderRight: '1px solid var(--border-color, #e2e8f0)',
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
          style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: '#3F6212' }}
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
              minWidth: `var(--field-width-${field.id}, ${columnWidth}px)`,
              maxWidth: `var(--field-width-${field.id}, ${columnWidth}px)`,
              flexShrink: 0,
              height: '100%',
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
              borderRight: isPrimary ? '2px solid var(--border-color, #cbd5e1)' : '1px solid var(--border-color, #e2e8f0)',
              boxSizing: 'border-box',
              transition: 'background-color 0.15s, box-shadow 0.15s',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectColumn?.(fieldIndex);
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

            {/* Column Resize Handle */}
            <div
              className={`grid-view__column-resize-handle ${isResizingThis || isHoveringResize ? 'active' : ''}`}
              title="按住拖曳調整欄寬，連按兩下自動最適寬度 (Auto-fit)"
              onMouseEnter={() => setHoveringResizeFieldId(field.id)}
              onMouseLeave={() => {
                if (resizingFieldId !== field.id) {
                  setHoveringResizeFieldId(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onAutoFitColumn?.(field.id);
              }}
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
              {/* Baserow Accent Pill Indicator on Hover/Drag */}
              <div
                className="resize-handle-pill"
                style={{
                  backgroundColor: (isHoveringResize || isResizingThis) ? '#3F6212' : undefined,
                  boxShadow: (isHoveringResize || isResizingThis) ? '0 0 6px rgba(63, 98, 18, 0.4)' : undefined,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* 3. Add Field Column (100px wide, matching Baserow) */}
      <div
        className="grid-view__column grid-view__add-field"
        style={{
          width: '100px',
          minWidth: '100px',
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          borderRight: '1px solid var(--border-color, #e2e8f0)',
          boxSizing: 'border-box',
          background: '#f8fafc',
          transition: 'background 0.15s ease'
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onAddFieldPopover?.({ top: rect.bottom + 4, left: Math.max(16, rect.left - 100) });
          onAddField?.();
        }}
        title={t('gridHead.addFieldTooltip')}
      >
        <div
          className="add-field-icon-box"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '24px',
            borderRadius: '4px',
            transition: 'all 0.15s ease',
          }}
        >
          <Plus style={{ width: '16px', height: '16px', color: '#64748b' }} />
        </div>
      </div>

      {/* 4. Right Buffer Space (100px buffer, matching Baserow width += 100 + 100) */}
      <div
        className="grid-view__column grid-view__head-buffer"
        style={{
          width: '100px',
          minWidth: '100px',
          flexShrink: 0,
          height: '100%',
          boxSizing: 'border-box',
          background: '#ffffff',
        }}
      />
    </div>
  );
};

export const GridViewHead = React.memo<GridViewHeadProps>(GridViewHeadInner);

