'use client';

import React, { useState } from 'react';
import { TableField } from '@/modules/database/types';
import { GridViewCell } from './GridViewCell';
import { GripVertical, Maximize2 } from 'lucide-react';

interface GridViewRowProps {
  row: {
    id: number;
    order?: number;
    values: Record<number, any>;
  };
  rowIndex: number;
  fields: TableField[];
  rowDetailsWidth?: number;
  selectedColumnIndex: number | null;
  isCellEditing: boolean;
  selectionBounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number; isMulti: boolean } | null;
  onSelectCell: (colIndex: number, e?: React.MouseEvent) => void;
  onMouseEnterCell?: (colIndex: number) => void;
  onStartAutofillCell?: (colIndex: number, e: React.MouseEvent) => void;
  onStartEditCell: (colIndex: number) => void;
  onUpdateCell: (fieldId: number, value: any) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onCancelEditCell: () => void;
  onExpandRow?: () => void;
}

export const GridViewRow: React.FC<GridViewRowProps> = ({
  row,
  rowIndex,
  fields,
  rowDetailsWidth = 56,
  selectedColumnIndex,
  isCellEditing,
  selectionBounds,
  onSelectCell,
  onMouseEnterCell,
  onStartAutofillCell,
  onStartEditCell,
  onUpdateCell,
  onUpdateField,
  onCancelEditCell,
  onExpandRow,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`grid-view__row ${isHovered ? 'hover' : ''}`} 
      style={{ display: 'flex', width: 'max-content', minWidth: '100%', minHeight: 'var(--row-height, 33px)' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. Row Index / Actions Column */}
      <div
        className="grid-view__column grid-view__column--no-border-right"
        style={{ width: `${rowDetailsWidth}px`, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={(e) => {
          onSelectCell(0, e);
        }}
      >
        {isHovered ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#64748b' }}>
            <GripVertical style={{ width: '14px', height: '14px', cursor: 'grab' }} />
            <input
              type="checkbox"
              checked={Boolean(selectionBounds && selectionBounds.minRow <= rowIndex && selectionBounds.maxRow >= rowIndex)}
              onChange={(e) => {
                e.stopPropagation();
                onSelectCell(0);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '14px', height: '14px', cursor: 'pointer' }}
            />
            <Maximize2 
              style={{ width: '14px', height: '14px', cursor: 'pointer' }} 
              onClick={(e) => {
                e.stopPropagation();
                onExpandRow?.();
              }}
            />
          </div>
        ) : (
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
            {rowIndex + 1}
          </span>
        )}
      </div>

      {/* 2. Row Cells */}
      {fields.map((field, cIndex) => {
        const isSelected = selectedColumnIndex === cIndex;
        const cellValue = row.values?.[field.id] ?? (row as any).data?.[`field_${field.id}`] ?? (row as any).data?.[field.id] ?? null;

        const isInRange = Boolean(
          selectionBounds?.isMulti &&
          rowIndex >= selectionBounds.minRow &&
          rowIndex <= selectionBounds.maxRow &&
          cIndex >= selectionBounds.minCol &&
          cIndex <= selectionBounds.maxCol
        );

        const rangeEdges = isInRange && selectionBounds ? {
          top: rowIndex === selectionBounds.minRow,
          bottom: rowIndex === selectionBounds.maxRow,
          left: cIndex === selectionBounds.minCol,
          right: cIndex === selectionBounds.maxCol,
        } : undefined;

        return (
          <GridViewCell
            key={field.id}
            rowId={row.id}
            field={field}
            value={cellValue}
            isSelected={isSelected}
            isEditing={isSelected && isCellEditing}
            isInRange={isInRange}
            rangeEdges={rangeEdges}
            onSelect={(e) => onSelectCell(cIndex, e)}
            onMouseEnterCell={() => onMouseEnterCell?.(cIndex)}
            onStartAutofill={(e) => onStartAutofillCell?.(cIndex, e)}
            onStartEdit={() => onStartEditCell(cIndex)}
            onUpdate={(val) => onUpdateCell(field.id, val)}
            onUpdateField={onUpdateField}
            onCancelEdit={onCancelEditCell}
          />
        );
      })}
    </div>
  );
};
