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
  onAddField,
  onFieldClick,
  onOpenFieldContextMenu,
  onResizeColumn,
  onResizeColumnEnd,
  onReorderFields,
}) => {
  const [draggedFieldId, setDraggedFieldId] = React.useState<number | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = React.useState<number | null>(null);

  return (
    <div className="grid-view__head" style={{ display: 'flex', width: 'max-content', minWidth: '100%', minHeight: '33px' }}>
      {/* 1. Row Identifier / Number Header Column */}
      <div
        className="grid-view__column grid-view__column--no-border-right"
        style={{ width: `${rowDetailsWidth}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}
      >
        #
      </div>

      {/* 2. Field Column Headers */}
      {fields.map((field) => {
        const IconComponent = FIELD_TYPE_ICONS[field.type] || Type;
        const columnWidth = field.width || 180;
        const isSorted = sortField === `field_${field.id}`;
        const isDraggingThis = draggedFieldId === field.id;
        const isDragTarget = dragOverFieldId === field.id && draggedFieldId !== field.id;

        return (
          <div
            key={field.id}
            className="grid-view__column grid-view__column--field"
            draggable={true}
            onDragStart={(e) => {
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              position: 'relative',
              cursor: 'grab',
              backgroundColor: isDraggingThis ? '#e0f2fe' : isSorted ? '#f8fafc' : undefined,
              opacity: isDraggingThis ? 0.6 : 1,
              boxShadow: isDragTarget ? 'inset 3px 0 0 0 #2563eb' : undefined,
              transition: 'background-color 0.15s, box-shadow 0.15s',
            }}
            onClick={(e) => onFieldClick?.(field, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              onOpenFieldContextMenu?.(field, e.clientX, e.clientY);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1, pointerEvents: 'none' }}>
              <IconComponent style={{ width: '14px', height: '14px', color: isSorted ? '#2563eb' : '#64748b', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: isSorted ? 600 : 500, color: isSorted ? '#2563eb' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {field.name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {isSorted && (
                sortOrder === 'asc' 
                  ? <ArrowUp style={{ width: '12px', height: '12px', color: '#2563eb', flexShrink: 0 }} /> 
                  : <ArrowDown style={{ width: '12px', height: '12px', color: '#2563eb', flexShrink: 0 }} />
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

            {/* Resize Handle */}
            <div
              className="grid-view__description-icon"
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 10 }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startWidth = columnWidth;

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientX - startX;
                  const newWidth = Math.max(80, startWidth + delta);
                  onResizeColumn?.(field.id, newWidth);
                };

                const onMouseUp = (upEvent: MouseEvent) => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                  
                  const finalWidth = Math.max(80, startWidth + (upEvent.clientX - startX));
                  onResizeColumnEnd?.(field.id, finalWidth);

                  document.body.style.cursor = '';
                  document.body.style.userSelect = '';

                  const preventClick = (clickEvent: MouseEvent) => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                    window.removeEventListener('click', preventClick, true);
                  };
                  window.addEventListener('click', preventClick, true);
                  setTimeout(() => window.removeEventListener('click', preventClick, true), 10);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            />
          </div>
        );
      })}

      {/* 3. Add Field Column */}
      <div
        className="grid-view__column"
        style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={onAddField}
        title="Add column"
      >
        <Plus style={{ width: '16px', height: '16px', color: '#64748b' }} />
      </div>
    </div>
  );
};
