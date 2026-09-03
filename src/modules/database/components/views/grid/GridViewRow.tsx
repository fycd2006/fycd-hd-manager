'use client';

import React, { useState } from 'react';
import { TableField, RowColorRule } from '@/modules/database/types';
import { GridViewCell } from './GridViewCell';
import { evaluateCellCondition } from './cells/utils';
import { GripVertical, Maximize2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18nContext';

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
  rowColorRules?: RowColorRule[];
  rowDetailsWidth?: number;
  selectedColumnIndex?: number | null;
  isCellEditing?: boolean;
  initialTypeOverValue?: string | null;
  selectionBounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number; isMulti: boolean } | null;
  autofillBounds?: { minRow: number; maxRow: number; minCol: number; maxCol: number } | null;
  isRowSelectedDirectly?: boolean;
  canDrag?: boolean;
  onSelectCell: (colIndex: number, e?: React.MouseEvent) => void;
  onSelectRowHeader?: (rowIndex: number, e: React.MouseEvent) => void;
  onToggleRowCheckbox?: (rowId: number, e: React.MouseEvent) => void;
  onMouseEnterRowHeader?: (rowIndex: number, e?: React.MouseEvent) => void;
  onMouseEnterCell?: (colIndex: number, e: React.MouseEvent) => void;
  onStartAutofillCell?: (colIndex: number, e: React.MouseEvent) => void;
  onAutoFillDown?: (colIndex: number) => void;
  onStartEditCell: (colIndex: number, initialVal?: string) => void;
  onUpdateCell: (fieldId: number, value: any) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onCancelEditCell: () => void;
  selectedRowIndices?: number[];
  onExpandRow?: () => void;
  onReorderRows?: (sourceRowIndex: number | number[], targetRowIndex: number) => void;
  onNavigateCell?: (colIndex: number, direction: 'nextRow' | 'prevRow' | 'nextCol' | 'prevCol') => void;
  onContextMenuCell?: (colIndex: number, e: React.MouseEvent) => void;
  onContextMenuRowHeader?: (e: React.MouseEvent) => void;
}

const GridViewRowInner: React.FC<GridViewRowProps> = ({
  row,
  rowIndex,
  fields,
  rowColorRules,
  rowDetailsWidth = 56,
  selectedColumnIndex,
  isCellEditing,
  initialTypeOverValue,
  selectionBounds,
  autofillBounds,
  isRowSelectedDirectly = false,
  canDrag = true,
  onSelectCell,
  onSelectRowHeader,
  onToggleRowCheckbox,
  onMouseEnterRowHeader,
  onMouseEnterCell,
  onStartAutofillCell,
  onAutoFillDown,
  onStartEditCell,
  onUpdateCell,
  onUpdateField,
  onCancelEditCell,
  selectedRowIndices,
  onExpandRow,
  onReorderRows,
  onNavigateCell,
  onContextMenuCell,
  onContextMenuRowHeader,
}) => {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragTarget, setIsDragTarget] = useState(false);

  const isRowSelected = Boolean(isRowSelectedDirectly);

  const matchedColorBg = React.useMemo(() => {
    if (!rowColorRules || rowColorRules.length === 0) return null;
    const COLOR_MAP: Record<string, string> = {
      red: '#fef2f2',
      green: '#f0fdf4',
      blue: '#F4F4F5',
      yellow: '#fefce8',
      purple: '#faf5ff',
      orange: '#fff7ed'
    };
    for (const rule of rowColorRules) {
      if (!rule.fieldKey || !rule.value) continue;
      const fieldIdStr = rule.fieldKey.replace('field_', '');
      const fieldId = Number(fieldIdStr);
      const field = fields.find(f => f.id === fieldId || `field_${f.id}` === rule.fieldKey);
      const fieldKey = rule.fieldKey || `field_${fieldId}`;
      const hasKey = (row as any).data && fieldKey in (row as any).data;
      const val = hasKey ? (row as any).data[fieldKey] : (row.values?.[fieldId] ?? '');

      if (evaluateCellCondition(val, field, rule.operator, rule.value)) {
        return COLOR_MAP[rule.color] || '#F4F4F5';
      }
    }
    return null;
  }, [row, rowColorRules, fields]);

  return (
    <div 
      className={`grid-view__row ${isHovered ? 'hover' : ''}`} 
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragTarget) setIsDragTarget(true);
      }}
      onDragLeave={() => setIsDragTarget(false)}
      onDrop={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        setIsDragTarget(false);
        const dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            if (Array.isArray(parsed)) {
              const movingIndices = parsed.filter((i) => typeof i === 'number');
              if (movingIndices.length > 0 && !movingIndices.includes(rowIndex)) {
                onReorderRows?.(movingIndices, rowIndex);
                return;
              }
            }
          } catch {}

          if (dataStr.includes(',')) {
            const indices = dataStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((i) => !isNaN(i));
            if (indices.length > 0 && !indices.includes(rowIndex)) {
              onReorderRows?.(indices, rowIndex);
              return;
            }
          }

          const sourceIdx = parseInt(dataStr, 10);
          if (!isNaN(sourceIdx) && sourceIdx !== rowIndex) {
            onReorderRows?.([sourceIdx], rowIndex);
          }
        }
      }}
      style={{
        display: 'flex',
        width: 'max-content',
        minWidth: '100%',
        height: 'var(--row-height, 32px)',
        maxHeight: 'var(--row-height, 32px)',
        overflow: 'visible',
        borderTop: isDragTarget ? '2px solid #3F6212' : 'none',
        borderBottom: '1px solid var(--border-color, #E7E5E4)',
        boxSizing: 'border-box',
        background: matchedColorBg || undefined,
        opacity: (row as any)._isStagedForMove ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. Row Index / Actions Column (Sticky Left: 0) */}
      <div
        className="grid-view__column grid-view__column--no-border-right"
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) {
            e.preventDefault();
            return;
          }

          const isPartOfMulti = Boolean(
            isRowSelected && selectedRowIndices && selectedRowIndices.length > 1 && selectedRowIndices.includes(rowIndex)
          );
          const movingIndices = isPartOfMulti ? selectedRowIndices! : [rowIndex];

          const payload = JSON.stringify(movingIndices);
          e.dataTransfer.setData('application/json', payload);
          e.dataTransfer.setData('text/plain', movingIndices.join(','));
          e.dataTransfer.effectAllowed = 'move';

          // Floating drag badge (Ghost Image) for multi-row drag
          if (movingIndices.length > 1 && typeof document !== 'undefined') {
            const dragBadge = document.createElement('div');
            dragBadge.textContent = `移動 ${movingIndices.length} 列`;
            dragBadge.style.cssText = [
              'position: fixed',
              'top: -1000px',
              'left: -1000px',
              'background: #1e293b',
              'color: #ffffff',
              'font-size: 12px',
              'font-weight: 600',
              'padding: 5px 12px',
              'border-radius: 9999px',
              'box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28)',
              'border: 1px solid rgba(255, 255, 255, 0.2)',
              'z-index: 99999',
              'pointer-events: none',
              'white-space: nowrap',
            ].join(';');
            document.body.appendChild(dragBadge);
            if (e.dataTransfer.setDragImage) {
              e.dataTransfer.setDragImage(dragBadge, 20, 15);
            }
            setTimeout(() => {
              if (dragBadge.parentNode) {
                dragBadge.parentNode.removeChild(dragBadge);
              }
            }, 0);
          }
        }}
        style={{
          width: `${rowDetailsWidth}px`,
          minWidth: `${rowDetailsWidth}px`,
          maxWidth: `${rowDetailsWidth}px`,
          flexShrink: 0,
          boxSizing: 'border-box',
          height: 'var(--row-height, 32px)',
          maxHeight: 'var(--row-height, 32px)',
          overflow: 'hidden',
          position: 'sticky',
          left: 0,
          zIndex: 15,
          background: isRowSelected 
            ? '#F4F4F5' 
            : (isHovered ? '#F5F5F4' : (matchedColorBg || '#ffffff')),
          borderRight: '1px solid var(--border-color, #E7E5E4)',
          boxShadow: isRowSelected ? 'inset 3px 0 0 0 #3F6212' : (isHovered ? 'inset 3px 0 0 0 #A8A29E' : undefined),
          transition: 'background-color 0.12s ease, box-shadow 0.12s ease',
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canDrag ? 'grab' : 'pointer',
          userSelect: 'none',
        }}
        onMouseDown={(e) => {
          if (e.button === 0 && !canDrag) {
            onSelectRowHeader?.(rowIndex, e);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenuRowHeader?.(e);
        }}
        onMouseEnter={(e) => {
          setIsHovered(true);
          onMouseEnterRowHeader?.(rowIndex, e);
        }}
        onDragEnd={() => {
          setIsDragTarget(false);
        }}
        onMouseLeave={() => setIsHovered(false)}
        title={!canDrag ? (t('toolbar.sortActiveDragDisabled') || '已套用排序條件，無法手動拖曳調整順序') : undefined}
      >
        {isHovered || isRowSelected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%', color: '#64748b' }}>
            {canDrag && (
              <span title="拖曳以手動排序" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <GripVertical
                  size={12}
                  style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }}
                />
              </span>
            )}
            <input
              type="checkbox"
              checked={isRowSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleRowCheckbox?.(row.id, e as any);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '13px',
                height: '13px',
                cursor: 'pointer',
                accentColor: '#3F6212',
                borderRadius: '3px',
                flexShrink: 0,
              }}
              title="選取列"
            />
            <div
              onClick={(e) => {
                e.stopPropagation();
                onExpandRow?.();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.12s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
              title="展開詳細資料 (Space)"
            >
              <Maximize2 style={{ width: '11px', height: '11px' }} />
            </div>
          </div>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: isRowSelected ? '#3F6212' : '#94a3b8', fontWeight: isRowSelected ? 600 : 400 }}>
            {rowIndex + 1}
          </span>
        )}
      </div>

      {/* 2. Row Cells */}
      {fields.map((field, cIndex) => {
        const isSelected = selectedColumnIndex === cIndex;
        const fieldKey = `field_${field.id}`;
        const hasFieldKey = (row as any).data && fieldKey in (row as any).data;
        const cellValue = hasFieldKey ? (row as any).data[fieldKey] : (row.values?.[field.id] ?? null);

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

        const isInAutofillRange = Boolean(
          autofillBounds &&
          rowIndex >= autofillBounds.minRow &&
          rowIndex <= autofillBounds.maxRow &&
          cIndex >= autofillBounds.minCol &&
          cIndex <= autofillBounds.maxCol
        );

        return (
          <GridViewCell
            key={field.id}
            rowId={row.id}
            field={field}
            value={cellValue}
            isSelected={Boolean(isSelected)}
            isEditing={Boolean(isSelected && isCellEditing)}
            isInRange={isInRange}
            isInAutofillRange={isInAutofillRange}
            isRowSelected={isRowSelected}
            isRowHovered={isHovered}
            rangeEdges={rangeEdges}
            isPrimary={cIndex === 0}
            rowColorBg={matchedColorBg}
            rowDetailsWidth={rowDetailsWidth}
            initialTypeOverValue={isSelected ? initialTypeOverValue : undefined}
            onSelect={(e) => onSelectCell(cIndex, e)}
            onMouseEnterCell={(e) => onMouseEnterCell?.(cIndex, e)}
            onStartAutofill={(e) => onStartAutofillCell?.(cIndex, e)}
            onAutoFillDown={() => onAutoFillDown?.(cIndex)}
            onStartEdit={(initVal?: string) => onStartEditCell(cIndex, initVal)}
            onUpdate={(val) => onUpdateCell(field.id, val)}
            onUpdateField={onUpdateField}
            onCancelEdit={onCancelEditCell}
            onNavigateCell={(dir) => onNavigateCell?.(cIndex, dir)}
            onContextMenu={(e) => onContextMenuCell?.(cIndex, e)}
          />
        );
      })}
    </div>
  );
};

export const GridViewRow = React.memo<GridViewRowProps>(GridViewRowInner, (prev, next) => {
  // 1. Data equality
  if (prev.row !== next.row) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.fields !== next.fields) return false;
  if (prev.rowColorRules !== next.rowColorRules) return false;
  if (prev.rowDetailsWidth !== next.rowDetailsWidth) return false;
  if (prev.canDrag !== next.canDrag) return false;

  // 2. Focused cell & Editing state for this specific row
  if (prev.selectedColumnIndex !== next.selectedColumnIndex) return false;
  if (prev.isCellEditing !== next.isCellEditing) return false;
  if (prev.isRowSelectedDirectly !== next.isRowSelectedDirectly) return false;
  if (prev.selectedRowIndices !== next.selectedRowIndices) return false;
  if (prev.initialTypeOverValue !== next.initialTypeOverValue) return false;

  // 3. Multi-selection range changes affecting this row
  const wasInSelection = Boolean(
    prev.selectionBounds?.isMulti &&
    prev.rowIndex >= prev.selectionBounds.minRow &&
    prev.rowIndex <= prev.selectionBounds.maxRow
  );
  const isInSelection = Boolean(
    next.selectionBounds?.isMulti &&
    next.rowIndex >= next.selectionBounds.minRow &&
    next.rowIndex <= next.selectionBounds.maxRow
  );
  if (wasInSelection !== isInSelection) return false;
  if (isInSelection) {
    if (
      prev.selectionBounds?.minCol !== next.selectionBounds?.minCol ||
      prev.selectionBounds?.maxCol !== next.selectionBounds?.maxCol ||
      prev.selectionBounds?.minRow !== next.selectionBounds?.minRow ||
      prev.selectionBounds?.maxRow !== next.selectionBounds?.maxRow
    ) {
      return false;
    }
  }

  // 4. Autofill preview range changes affecting this row
  const wasInAutofill = Boolean(
    prev.autofillBounds &&
    prev.rowIndex >= prev.autofillBounds.minRow &&
    prev.rowIndex <= prev.autofillBounds.maxRow
  );
  const isInAutofill = Boolean(
    next.autofillBounds &&
    next.rowIndex >= next.autofillBounds.minRow &&
    next.rowIndex <= next.autofillBounds.maxRow
  );
  if (wasInAutofill !== isInAutofill) return false;
  if (isInAutofill) {
    if (
      prev.autofillBounds?.minCol !== next.autofillBounds?.minCol ||
      prev.autofillBounds?.maxCol !== next.autofillBounds?.maxCol
    ) {
      return false;
    }
  }

  return true;
});
