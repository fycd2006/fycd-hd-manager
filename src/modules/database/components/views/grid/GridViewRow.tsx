'use client';

import React, { useState } from 'react';
import { TableField } from '@/modules/database/types';
import { GridViewCell } from './GridViewCell';
import { GripVertical, Maximize2 } from 'lucide-react';

interface RowData {
  id: number;
  order?: number;
  values: Record<number, any>;
  [key: string]: any;
}

interface GridViewRowProps {
  row: RowData;
  rowIndex: number;
  fields: TableField[];
  rowDetailsWidth?: number;
  selectedColumnIndex?: number | null;
  isCellEditing?: boolean;
  selectionBounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number; isMulti: boolean } | null;
  isRowSelectedDirectly?: boolean;
  onSelectCell: (colIndex: number, e?: React.MouseEvent) => void;
  onSelectRowHeader?: (rowIndex: number, e: React.MouseEvent) => void;
  onToggleRowCheckbox?: (rowId: number, e: React.MouseEvent) => void;
  onMouseEnterRowHeader?: (rowIndex: number) => void;
  onMouseEnterCell?: (colIndex: number) => void;
  onStartAutofillCell?: (colIndex: number, e: React.MouseEvent) => void;
  onStartEditCell: (colIndex: number) => void;
  onUpdateCell: (fieldId: number, value: any) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onCancelEditCell: () => void;
  onExpandRow?: () => void;
  onReorderRows?: (sourceRowIndex: number, targetRowIndex: number) => void;
}

export const GridViewRow: React.FC<GridViewRowProps> = ({
  row,
  rowIndex,
  fields,
  rowDetailsWidth = 56,
  selectedColumnIndex,
  isCellEditing,
  selectionBounds,
  isRowSelectedDirectly = false,
  onSelectCell,
  onSelectRowHeader,
  onToggleRowCheckbox,
  onMouseEnterRowHeader,
  onMouseEnterCell,
  onStartAutofillCell,
  onStartEditCell,
  onUpdateCell,
  onUpdateField,
  onCancelEditCell,
  onExpandRow,
  onReorderRows,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragTarget, setIsDragTarget] = useState(false);

  const isRowSelected = Boolean(
    isRowSelectedDirectly ||
    (selectionBounds &&
    selectionBounds.minCol === 0 &&
    selectionBounds.maxCol === Math.max(0, fields.length - 1) &&
    rowIndex >= selectionBounds.minRow &&
    rowIndex <= selectionBounds.maxRow)
  );

  return (
    <div 
      className={`grid-view__row ${isHovered ? 'hover' : ''}`} 
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragTarget) setIsDragTarget(true);
      }}
      onDragLeave={() => setIsDragTarget(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragTarget(false);
        const sourceIdxStr = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
        if (sourceIdxStr !== '') {
          const sourceIdx = parseInt(sourceIdxStr, 10);
          if (!isNaN(sourceIdx) && sourceIdx !== rowIndex) {
            onReorderRows?.(sourceIdx, rowIndex);
          }
        }
      }}
      style={{
        display: 'flex',
        width: 'max-content',
        minWidth: '100%',
        minHeight: 'var(--row-height, 33px)',
        borderTop: isDragTarget ? '2px solid #2563eb' : undefined,
        boxSizing: 'border-box',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. Row Index / Actions Column (Sticky Left: 0) */}
      <div
        className="grid-view__column grid-view__column--no-border-right"
        style={{
          width: `${rowDetailsWidth}px`,
          position: 'sticky',
          left: 0,
          zIndex: 15,
          background: isRowSelected ? 'linear-gradient(rgba(37, 99, 235, 0.08), rgba(37, 99, 235, 0.08)), #ffffff' : '#ffffff',
          borderRight: '1px solid var(--border-color, #e2e8f0)',
          borderLeft: isRowSelected ? '3px solid #2563eb' : 'none',
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onMouseDown={(e) => {
          if (e.button === 0) {
            onSelectRowHeader?.(rowIndex, e);
          }
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          onMouseEnterRowHeader?.(rowIndex);
        }}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered || isRowSelected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#64748b' }}>
            <span
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(rowIndex));
                e.dataTransfer.setData('text', String(rowIndex));
                e.dataTransfer.effectAllowed = 'move';
              }}
              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'grab', padding: '2px', borderRadius: '4px' }}
              title="按住並拖曳即可移動此列"
            >
              <GripVertical style={{ width: '14px', height: '14px', cursor: 'grab' }} />
            </span>
            <input
              type="checkbox"
              checked={isRowSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleRowCheckbox?.(row.id, e as any);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleRowCheckbox?.(row.id, e);
              }}
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
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: isRowSelected ? '#2563eb' : '#94a3b8', fontWeight: isRowSelected ? 600 : 400 }}>
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
            isSelected={Boolean(isSelected)}
            isEditing={Boolean(isSelected && isCellEditing)}
            isInRange={isInRange}
            isRowSelected={isRowSelected}
            rangeEdges={rangeEdges}
            isPrimary={cIndex === 0}
            rowDetailsWidth={rowDetailsWidth}
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
