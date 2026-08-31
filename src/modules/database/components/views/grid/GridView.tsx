'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { TableField, RowColorRule, GroupCollapseState, GroupByRule, SortRule } from '@/modules/database/types';
import { getOptionColor, parseSelectItems } from '@/modules/database/components/views/grid/cells/utils';
import { GridViewHead } from './GridViewHead';
import { GridViewRow } from './GridViewRow';
import GridViewFieldFooter from '@/modules/database/components/table/GridViewFieldFooter';
import { MultiCellContextMenu } from '@/modules/database/components/menu/MultiCellContextMenu';
import PopoverPortal from '@/components/ui/PopoverPortal';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';

export interface RowData {
  id: number;
  order?: number;
  values: Record<number, any>;
}

export interface GroupBadge {
  label: string;
  bg?: string;
  color?: string;
  border?: string;
}

export function parseGroupValue(
  rawVal: any,
  field: TableField | null | undefined,
  relationMap?: Map<string | number, string>
): {
  key: string;
  displayTitle: string;
  badges: GroupBadge[];
  isBlank: boolean;
} {
  if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === '[]' || rawVal === '{}') {
    return {
      key: '（空白）',
      displayTitle: '（空白未指定）',
      badges: [{ label: '（空白未指定）', bg: '#f1f5f9', color: '#94a3b8' }],
      isBlank: true,
    };
  }

  // Attempt JSON parse if string is stringified array or object
  let val = rawVal;
  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        val = JSON.parse(trimmed);
      } catch {}
    }
  }

  // 1. Select fields (single_select / multiple_select)
  if (field && (field.type === 'single_select' || field.type === 'multiple_select')) {
    const items = parseSelectItems(rawVal, field.options);
    if (items.length === 0) {
      return {
        key: '（空白）',
        displayTitle: '（空白未指定）',
        badges: [{ label: '（空白未指定）', bg: '#f1f5f9', color: '#94a3b8' }],
        isBlank: true,
      };
    }
    const badges: GroupBadge[] = items.map(item => {
      const color: any = getOptionColor(item, field.options as any);
      return {
        label: item,
        bg: color.bg || color.backgroundColor,
        color: color.text || color.color,
        border: color.border || 'transparent',
      };
    });
    return {
      key: items.join(', '),
      displayTitle: items.join(', '),
      badges,
      isBlank: false,
    };
  }

  // 2. Link Row fields
  if (field && field.type === 'link_row') {
    const items = Array.isArray(val) ? val : [val];
    const badges: GroupBadge[] = [];
    const keyParts: string[] = [];

    items.forEach((item: any) => {
      if (typeof item === 'object' && item !== null) {
        const itemVal = item.value || item.name || item.title || item.label;
        const itemId = item.id != null ? String(item.id) : '';
        const resolvedName = (itemId && relationMap?.get(itemId)) || (item.id != null && relationMap?.get(item.id));
        const label = String(resolvedName || itemVal || (itemId ? `列 ID: ${itemId}` : ''));
        if (label) {
          const color: any = getOptionColor(label);
          badges.push({
            label,
            bg: color.bg || '#fee2e2',
            color: color.text || '#991b1b',
            border: color.border || '#fca5a5',
          });
          keyParts.push(itemId || label);
        }
      } else {
        const itemStr = String(item).trim();
        if (itemStr) {
          const resolvedName = relationMap?.get(itemStr);
          const label = resolvedName || itemStr;
          const color: any = getOptionColor(label);
          badges.push({
            label,
            bg: color.bg || '#fee2e2',
            color: color.text || '#991b1b',
            border: color.border || '#fca5a5',
          });
          keyParts.push(itemStr);
        }
      }
    });

    if (badges.length === 0) {
      return {
        key: '（空白）',
        displayTitle: '（空白未指定）',
        badges: [{ label: '（空白未指定）', bg: '#f1f5f9', color: '#94a3b8' }],
        isBlank: true,
      };
    }

    return {
      key: keyParts.join(', '),
      displayTitle: badges.map(b => b.label).join(', '),
      badges,
      isBlank: false,
    };
  }

  // 3. Boolean
  if ((field && field.type === 'boolean') || typeof val === 'boolean') {
    const isTrue = val === true || val === 'true' || val === 1 || val === '1';
    return {
      key: isTrue ? '是 (Yes)' : '否 (No)',
      displayTitle: isTrue ? '是 (Yes)' : '否 (No)',
      badges: [{
        label: isTrue ? '是 (Yes)' : '否 (No)',
        bg: isTrue ? '#dcfce7' : '#f1f5f9',
        color: isTrue ? '#166534' : '#475569',
        border: isTrue ? '#86efac' : '#cbd5e1',
      }],
      isBlank: false,
    };
  }

  // 4. Rating
  if (field && field.type === 'rating') {
    const starCount = Math.min(5, Math.max(0, parseInt(String(val), 10) || 0));
    if (starCount === 0) {
      return {
        key: '（空白）',
        displayTitle: '（空白未指定）',
        badges: [{ label: '（空白未指定）', bg: '#f1f5f9', color: '#94a3b8' }],
        isBlank: true,
      };
    }
    const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
    return {
      key: `${starCount} 星`,
      displayTitle: `${stars} (${starCount} 星)`,
      badges: [{
        label: `${stars} (${starCount} 星)`,
        bg: '#fef9c3',
        color: '#854d0e',
        border: '#fde047',
      }],
      isBlank: false,
    };
  }

  // 5. Date
  if (field && (field.type === 'date' || field.type === 'created_at' || field.type === 'updated_at')) {
    const dateStr = String(val).trim();
    if (!dateStr) {
      return {
        key: '（空白）',
        displayTitle: '（空白未指定）',
        badges: [{ label: '（空白未指定）', bg: '#f1f5f9', color: '#94a3b8' }],
        isBlank: true,
      };
    }
    const formatted = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
    return {
      key: formatted,
      displayTitle: formatted,
      badges: [{
        label: formatted,
        bg: '#f8fafc',
        color: '#334155',
        border: '#e2e8f0',
      }],
      isBlank: false,
    };
  }

  // 6. Arrays
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return {
        key: '（空白）',
        displayTitle: '（空白未指定）',
        badges: [{ label: '（空白未指定）', bg: '#f1f5f9', color: '#94a3b8' }],
        isBlank: true,
      };
    }
    const badges = val.map((v: any) => ({
      label: typeof v === 'object' ? v.value || v.name || String(v) : String(v),
      bg: '#f1f5f9',
      color: '#334155',
      border: '#e2e8f0',
    }));
    return {
      key: badges.map(b => b.label).join(', '),
      displayTitle: badges.map(b => b.label).join(', '),
      badges,
      isBlank: false,
    };
  }

  // 5. Object
  if (typeof val === 'object' && val !== null) {
    const label = val.value || val.name || val.title || val.label || String(val);
    return {
      key: String(label),
      displayTitle: String(label),
      badges: [{ label: String(label), bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' }],
      isBlank: false,
    };
  }

  // 6. Generic Primitive
  const str = String(val).trim();
  return {
    key: str || '（空白）',
    displayTitle: str || '（空白未指定）',
    badges: [{ label: str || '（空白未指定）', bg: '#f1f5f9', color: str ? '#1e293b' : '#94a3b8' }],
    isBlank: !str,
  };
}

export function isGroupCollapsed(groupKey: string, collapseState: GroupCollapseState): boolean {
  const isException = Boolean(collapseState.exceptions[groupKey]);
  return collapseState.mode === 'collapse' ? !isException : isException;
}

export function computeFieldSummaries(rowsList: RowData[], fieldList: TableField[]) {
  const result: Record<number, {
    count: number;
    emptyCount: number;
    percentFilled: number;
    sum: number | null;
    avg: number | null;
    min: any;
    max: any;
    uniqueCount: number;
  }> = {};

  fieldList.forEach((field) => {
    let count = 0;
    let emptyCount = 0;
    let sum = 0;
    let numericCount = 0;
    let minVal: any = null;
    let maxVal: any = null;
    const uniqueVals = new Set<string>();

    rowsList.forEach((row) => {
      const val = row.values[field.id];
      if (val !== undefined && val !== null && val !== '') {
        count++;
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        uniqueVals.add(strVal);

        const num = Number(val);
        if (!isNaN(num) && typeof val !== 'boolean') {
          sum += num;
          numericCount++;
          if (minVal === null || num < minVal) minVal = num;
          if (maxVal === null || num > maxVal) maxVal = num;
        } else {
          if (minVal === null || strVal < String(minVal)) minVal = strVal;
          if (maxVal === null || strVal > String(maxVal)) maxVal = strVal;
        }
      } else {
        emptyCount++;
      }
    });

    const total = rowsList.length;
    const percentFilled = total > 0 ? Math.round((count / total) * 100) : 0;

    result[field.id] = {
      count,
      emptyCount,
      percentFilled,
      sum: numericCount > 0 ? Number(sum.toFixed(2)) : null,
      avg: numericCount > 0 ? Number((sum / numericCount).toFixed(2)) : null,
      min: minVal,
      max: maxVal,
      uniqueCount: uniqueVals.size,
    };
  });

  return result;
}

interface GridViewProps {
  fields: TableField[];
  rows: RowData[];
  sortField?: string | null;
  sortOrder?: 'asc' | 'desc';
  sortRules?: SortRule[];
  groupByField?: string | null;
  groupByRules?: GroupByRule[];
  groupCollapseState?: GroupCollapseState;
  onUpdateGroupCollapseState?: (state: GroupCollapseState | ((prev: GroupCollapseState) => GroupCollapseState)) => void;
  rowColorRules?: RowColorRule[];
  rowDetailsWidth?: number;
  onUpdateCell?: (rowId: number, fieldId: any, value?: any) => void;
  onBatchUpdateCells?: (updates: Array<{ rowId: number; data: Record<string, any> }>) => void;
  onAddRow?: () => void;
  onAddField?: () => void;
  onAddFieldPopover?: (position: { top: number; left: number }) => void;
  onResizeColumn?: (fieldId: number, newWidth: number) => void;
  onResizeColumnEnd?: (fieldId: number, newWidth: number) => void;
  onExpandRow?: (rowId: number) => void;
  onDeleteRow?: (rowId: number) => void;
  onFieldClick?: (field: TableField, e: React.MouseEvent) => void;
  onOpenFieldContextMenu?: (field: TableField, x: number, y: number) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onUndo?: () => Promise<boolean | void> | boolean | void;
  onRedo?: () => Promise<boolean | void> | boolean | void;
  onReorderFields?: (sourceFieldId: number, targetFieldId: number) => void;
  onReorderRows?: (sourceRowIndex: number, targetRowIndex: number) => void;
  onBatchAddRows?: (rows: Array<Record<string, any>>) => void;
  batchMoveRows?: (rowsToMove: Array<{ sourceRowId: number, data: Record<string, any> }>) => boolean;
  stageMoveRows?: (rowIds: number[]) => void;
  cancelMoveRows?: () => void;
  isOffline?: boolean;
  tableId?: number | null;
  viewId?: number | null;
  initialAggregations?: Record<string | number, string> | string | null;
  onUpdateAggregations?: (agg: Record<string | number, string>) => void;
}

export const GridView: React.FC<GridViewProps> = ({
  fields,
  rows,
  sortField,
  sortOrder,
  sortRules,
  groupByField,
  groupByRules,
  groupCollapseState,
  onUpdateGroupCollapseState,
  rowColorRules,
  rowDetailsWidth = 56,
  tableId,
  viewId,
  initialAggregations,
  onUpdateAggregations,
  onUpdateCell,
  onBatchUpdateCells,
  onAddRow,
  onAddField,
  onAddFieldPopover,
  onResizeColumn,
  onResizeColumnEnd,
  onExpandRow,
  onDeleteRow,
  onFieldClick,
  onOpenFieldContextMenu,
  onUpdateField,
  onUndo,
  onRedo,
  onReorderFields,
  onReorderRows,
  onBatchAddRows,
  batchMoveRows,
  stageMoveRows,
  cancelMoveRows,
  isOffline = false,
}) => {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [editingCellInfo, setEditingCellInfo] = useState<{ rowId: number; colIndex: number } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectionStart, setSelectionStart] = useState<[number, number] | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<[number, number] | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState<boolean>(false);
  const [isAutofilling, setIsAutofilling] = useState<boolean>(false);
  const [autofillStart, setAutofillStart] = useState<[number, number] | null>(null);
  const [autofillEnd, setAutofillEnd] = useState<[number, number] | null>(null);
  const [cellContextMenu, setCellContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [batchAddMenuPosition, setBatchAddMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);

  // Auto-scroll when new fields are created on the current active table
  const prevFieldsCountRef = useRef(fields.length);
  const prevTableIdRef = useRef(tableId);

  useEffect(() => {
    // 1. Table switch or initial load: reset horizontal scroll position to first column
    if (prevTableIdRef.current !== tableId) {
      prevTableIdRef.current = tableId;
      prevFieldsCountRef.current = fields.length;
      if (bodyRef.current) {
        bodyRef.current.scrollLeft = 0;
      }
      return;
    }

    // 2. Only smooth scroll to the newly created field when working within the same table
    if (prevFieldsCountRef.current > 0 && fields.length > prevFieldsCountRef.current && bodyRef.current) {
      bodyRef.current.scrollTo({ left: bodyRef.current.scrollWidth, behavior: 'smooth' });
    }
    prevFieldsCountRef.current = fields.length;
  }, [fields.length, tableId]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2200);
  }, []);


  const selectionBounds = useMemo(() => {
    if (!selectionStart || !selectionEnd) return null;
    const minRow = Math.min(selectionStart[0], selectionEnd[0]);
    const maxRow = Math.max(selectionStart[0], selectionEnd[0]);
    const minCol = Math.min(selectionStart[1], selectionEnd[1]);
    const maxCol = Math.max(selectionStart[1], selectionEnd[1]);
    const isMulti = minRow !== maxRow || minCol !== maxCol;
    return { minRow, maxRow, minCol, maxCol, isMulti };
  }, [selectionStart, selectionEnd]);

  const handleCopySelection = useCallback(() => {
    const lines: string[] = [];
    if (selectedRowIds.size > 0) {
      rows.forEach((row) => {
        if (selectedRowIds.has(row.id)) {
          const rowCells: string[] = fields.map((field) => {
            const fk = `field_${field.id}`;
            const hasK = (row as any).data && fk in (row as any).data;
            const val = hasK ? (row as any).data[fk] : (row.values?.[field.id] ?? '');
            return String(val ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ');
          });
          lines.push(rowCells.join('\t'));
        }
      });
    } else if (selectionBounds) {
      for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const rowCells: string[] = [];
        for (let c = selectionBounds.minCol; c <= selectionBounds.maxCol; c++) {
          const field = fields[c];
          if (!field) continue;
          const fk = `field_${field.id}`;
          const hasK = (row as any).data && fk in (row as any).data;
          const val = hasK ? (row as any).data[fk] : (row.values?.[field.id] ?? '');
          rowCells.push(String(val ?? '').replace(/\t/g, ' ').replace(/\n/g, ' '));
        }
        lines.push(rowCells.join('\t'));
      }
    }
    const tsv = lines.join('\n');
    if (tsv && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tsv);
      showToast('已複製資料至剪貼簿');
    }
  }, [selectedRowIds, selectionBounds, rows, fields, showToast]);

  const handleClearSelectionValues = useCallback(() => {
    setIsEditing(false);
    const rowMap = new Map<number, Record<string, any>>();
    if (selectedRowIds.size > 0) {
      rows.forEach((row) => {
        if (selectedRowIds.has(row.id)) {
          const map = rowMap.get(row.id) || {};
          fields.forEach((field) => {
            map[`field_${field.id}`] = null;
          });
          rowMap.set(row.id, map);
        }
      });
      showToast('已清空選取列內容');
    } else if (selectionBounds) {
      for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
        for (let c = selectionBounds.minCol; c <= selectionBounds.maxCol; c++) {
          const targetRow = rows[r];
          const targetField = fields[c];
          if (targetRow && targetField) {
            const map = rowMap.get(targetRow.id) || {};
            map[`field_${targetField.id}`] = null;
            rowMap.set(targetRow.id, map);
          }
        }
      }
      showToast('已清空選取儲存格內容');
    }

    if (rowMap.size > 0) {
      const batchUpdates = Array.from(rowMap.entries()).map(([rowId, data]) => ({ rowId, data }));
      if (onBatchUpdateCells) {
        onBatchUpdateCells(batchUpdates);
      } else {
        (async () => {
          const entries = Array.from(rowMap.entries());
          for (let i = 0; i < entries.length; i += 2) {
            const chunk = entries.slice(i, i + 2);
            await Promise.all(chunk.map(([rowId, dataMap]) => onUpdateCell?.(rowId, dataMap as any)));
            if (i + 2 < entries.length) await new Promise(res => setTimeout(res, 20));
          }
        })();
      }
    }
  }, [selectedRowIds, selectionBounds, rows, fields, onUpdateCell, onBatchUpdateCells, showToast]);

  const handleDeleteSelectedRows = useCallback(() => {
    if (isOffline) {
      showToast('目前處於離線狀態，請於連線恢復後再試');
      return;
    }
    const rowIdsToDelete = new Set<number>(selectedRowIds);
    if (selectionBounds) {
      for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
        const targetRow = rows[r];
        if (targetRow) {
          rowIdsToDelete.add(targetRow.id);
        }
      }
    }
    const count = rowIdsToDelete.size;
    if (count === 0) return;
    rowIdsToDelete.forEach(id => onDeleteRow?.(id));
    setSelectedRowIds(new Set());
    setSelectedCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    showToast(`已成功刪除 ${count} 列資料`);
  }, [selectedRowIds, selectionBounds, rows, onDeleteRow, showToast]);

  const handleCutSelection = useCallback(() => {
    handleCopySelection();
    handleClearSelectionValues();
  }, [handleCopySelection, handleClearSelectionValues]);

  const handlePasteSelection = useCallback(async (pastedText?: string) => {
    if (isOffline) {
      showToast('目前處於離線狀態，請於連線恢復後再試');
      return;
    }
    let textToPaste = pastedText;
    if (!textToPaste && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        textToPaste = await navigator.clipboard.readText();
      } catch {}
    }
    if (!textToPaste) return;

    const lines = textToPaste.split(/\r?\n/).filter((line, i, arr) => i < arr.length - 1 || line.length > 0);
    if (lines.length === 0) return;
    const pastedGrid = lines.map(line => line.split('\t'));

    const rowMap = new Map<number, Record<string, any>>();

    if (selectionBounds && selectionBounds.isMulti) {
      // Batch paste into multi-cell selection bounds
      const rowCount = selectionBounds.maxRow - selectionBounds.minRow + 1;
      const colCount = selectionBounds.maxCol - selectionBounds.minCol + 1;

      for (let r = 0; r < rowCount; r++) {
        const targetRowIndex = selectionBounds.minRow + r;
        if (targetRowIndex >= rows.length) break;
        const targetRow = rows[targetRowIndex];
        const sourceRow = pastedGrid[r % pastedGrid.length];

        for (let c = 0; c < colCount; c++) {
          const targetColIndex = selectionBounds.minCol + c;
          if (targetColIndex >= fields.length) break;
          const targetField = fields[targetColIndex];
          const cellVal = sourceRow[c % sourceRow.length];

          if (targetRow && targetField) {
            const map = rowMap.get(targetRow.id) || {};
            map[`field_${targetField.id}`] = cellVal.trim();
            rowMap.set(targetRow.id, map);
          }
        }
      }
    } else if (selectionStart) {
      // Single focus cell selected -> paste grid starting at selectionStart
      const startRow = selectionStart[0];
      const startCol = selectionStart[1];

      pastedGrid.forEach((sourceRow, rOffset) => {
        const targetRowIndex = startRow + rOffset;
        if (targetRowIndex >= rows.length) return;
        const targetRow = rows[targetRowIndex];

        sourceRow.forEach((cellVal, cOffset) => {
          const targetColIndex = startCol + cOffset;
          if (targetColIndex >= fields.length) return;
          const targetField = fields[targetColIndex];
          if (targetRow && targetField) {
            const map = rowMap.get(targetRow.id) || {};
            map[`field_${targetField.id}`] = cellVal.trim();
            rowMap.set(targetRow.id, map);
          }
        });
      });
    }

    if (rowMap.size > 0) {
      const batchUpdates = Array.from(rowMap.entries()).map(([rowId, data]) => ({ rowId, data }));
      if (onBatchUpdateCells) {
        onBatchUpdateCells(batchUpdates);
      } else {
        (async () => {
          const entries = Array.from(rowMap.entries());
          for (let i = 0; i < entries.length; i += 2) {
            const chunk = entries.slice(i, i + 2);
            await Promise.all(chunk.map(([rowId, dataMap]) => onUpdateCell?.(rowId, dataMap as any)));
            if (i + 2 < entries.length) await new Promise(res => setTimeout(res, 20));
          }
        })();
      }
    }
  }, [selectionBounds, selectionStart, rows, fields, onUpdateCell, onBatchUpdateCells]);

  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputTarget = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"], [role="dialog"], .modal'))
      );
      if (isEditing || isInputTarget) return;

      const text = e.clipboardData?.getData('text/plain');
      if (text && (selectionBounds || selectionStart)) {
        e.preventDefault();
        handlePasteSelection(text);
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [isEditing, selectionBounds, selectionStart, handlePasteSelection]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isAutofilling && autofillStart && autofillEnd) {
        const srcRow = autofillStart[0];
        const srcCol = autofillStart[1];
        const targetField = fields[srcCol];
        const sourceRowData = rows[srcRow];

        if (targetField && sourceRowData) {
          const sourceValue = sourceRowData.values?.[targetField.id] ?? (sourceRowData as any).data?.[`field_${targetField.id}`] ?? (sourceRowData as any).data?.[targetField.id] ?? null;
          const minR = Math.min(autofillStart[0], autofillEnd[0]);
          const maxR = Math.max(autofillStart[0], autofillEnd[0]);
          const minC = Math.min(autofillStart[1], autofillEnd[1]);
          const maxC = Math.max(autofillStart[1], autofillEnd[1]);

          const rowMap = new Map<number, Record<string, any>>();
          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              const rData = rows[r];
              const fData = fields[c];
              if (rData && fData) {
                const map = rowMap.get(rData.id) || {};
                map[`field_${fData.id}`] = sourceValue;
                rowMap.set(rData.id, map);
              }
            }
          }
          if (rowMap.size > 0) {
            const batchUpdates = Array.from(rowMap.entries()).map(([rowId, data]) => ({ rowId, data }));
            if (onBatchUpdateCells) {
              onBatchUpdateCells(batchUpdates);
            } else {
              (async () => {
                const entries = Array.from(rowMap.entries());
                for (let i = 0; i < entries.length; i += 2) {
                  const chunk = entries.slice(i, i + 2);
                  await Promise.all(chunk.map(([rowId, dataMap]) => onUpdateCell?.(rowId, dataMap as any)));
                  if (i + 2 < entries.length) await new Promise(res => setTimeout(res, 20));
                }
              })();
            }
          }
        }
      }
      setIsDraggingSelection(false);
      setIsAutofilling(false);
      setAutofillStart(null);
      setAutofillEnd(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('dragend', handleMouseUp);
    window.addEventListener('drop', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('dragend', handleMouseUp);
      window.removeEventListener('drop', handleMouseUp);
    };
  }, [isAutofilling, autofillStart, autofillEnd, rows, fields, onUpdateCell]);


  const [internalCollapseState, setInternalCollapseState] = useState<GroupCollapseState>({
    mode: 'expand',
    exceptions: {},
  });

  const activeCollapseState = groupCollapseState ?? internalCollapseState;
  const updateCollapseState = onUpdateGroupCollapseState ?? setInternalCollapseState;

  const handleToggleGroup = useCallback((groupKey: string) => {
    updateCollapseState((prev) => {
      const currentlyCollapsed = isGroupCollapsed(groupKey, prev);
      const willBeCollapsed = !currentlyCollapsed;
      const newExceptions = { ...prev.exceptions };

      if ((prev.mode === 'collapse' && willBeCollapsed) || (prev.mode === 'expand' && !willBeCollapsed)) {
        delete newExceptions[groupKey];
      } else {
        newExceptions[groupKey] = true;
      }

      return {
        ...prev,
        exceptions: newExceptions,
      };
    });
  }, [updateCollapseState]);

  const effectiveGroupByRules = useMemo<GroupByRule[]>(() => {
    if (groupByRules && groupByRules.length > 0) return groupByRules;
    if (groupByField) {
      if (typeof groupByField === 'string' && groupByField.startsWith('[')) {
        try {
          const parsed = JSON.parse(groupByField);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      return [{ fieldKey: groupByField, order: 'asc' }];
    }
    return [];
  }, [groupByRules, groupByField]);

  const [relationRowsMap, setRelationRowsMap] = useState<Map<string | number, string>>(new Map());

  useEffect(() => {
    if (effectiveGroupByRules.length === 0) return;
    const linkRowFields = effectiveGroupByRules
      .map(r => fields.find(f => `field_${f.id}` === r.fieldKey || String(f.id) === r.fieldKey))
      .filter((f): f is TableField => !!f && f.type === 'link_row');

    if (linkRowFields.length === 0) return;

    const targetTableIds = new Set<number>();
    linkRowFields.forEach(f => {
      let opts: any = f.options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch {}
      }
      const targetTableId = Number(opts?.targetTableId ?? opts?.link_row_table_id ?? opts?.target_table_id);
      if (targetTableId) targetTableIds.add(targetTableId);
    });

    if (targetTableIds.size === 0) return;

    Promise.all(
      Array.from(targetTableIds).map(tId =>
        fetch(`/api/tables/${tId}/rows`)
          .then(res => res.ok ? res.json() : [])
          .then(data => Array.isArray(data) ? data : (data.rows || []))
          .catch(() => [])
      )
    ).then(results => {
      const newMap = new Map<string | number, string>();
      results.flat().forEach((r: any) => {
        const primaryVal = r.data ? Object.values(r.data).find(v => v != null && v !== '' && typeof v !== 'object') : null;
        const name = primaryVal ? String(primaryVal) : `列 ID: ${r.id}`;
        newMap.set(r.id, name);
        newMap.set(String(r.id), name);
      });
      setRelationRowsMap(newMap);
    }).catch(() => {});
  }, [effectiveGroupByRules, fields]);

  // Hierarchical Group Section Node Interface
  interface GroupSectionNode {
    key: string;
    fieldKey: string;
    field: TableField | null;
    level: number;
    displayTitle: string;
    badges: GroupBadge[];
    isBlank: boolean;
    rows: RowData[];
    originalIndices: number[];
    subGroups?: GroupSectionNode[];
    groupValues: Record<string, any>;
  }

  const frozenGroupedTreeRef = useRef<GroupSectionNode[] | null>(null);

  const groupedTree = useMemo<GroupSectionNode[] | null>(() => {
    if (effectiveGroupByRules.length === 0) {
      frozenGroupedTreeRef.current = null;
      return null;
    }

    if (isEditing && frozenGroupedTreeRef.current) {
      const rowMap = new Map<number, RowData>();
      rows.forEach(r => rowMap.set(r.id, r));

      const updateNodeRows = (node: GroupSectionNode): GroupSectionNode => ({
        ...node,
        rows: node.rows.map(r => rowMap.get(r.id) || r),
        subGroups: node.subGroups ? node.subGroups.map(updateNodeRows) : undefined,
      });

      return frozenGroupedTreeRef.current.map(updateNodeRows);
    }

    const buildTree = (
      subRows: RowData[],
      subIndices: number[],
      level: number,
      parentPath: string,
      parentValues: Record<string, any>
    ): GroupSectionNode[] => {
      if (level >= effectiveGroupByRules.length || subRows.length === 0) return [];

      const rule = effectiveGroupByRules[level];
      const field = fields.find(f => `field_${f.id}` === rule.fieldKey || String(f.id) === rule.fieldKey) || null;

      const map = new Map<string, {
        rawVal: any;
        displayTitle: string;
        badges: GroupBadge[];
        isBlank: boolean;
        rows: RowData[];
        originalIndices: number[];
      }>();

      subRows.forEach((row, rIdx) => {
        const rawVal = (row as any).data ? (row as any).data[rule.fieldKey] : (row.values ? row.values[parseInt(rule.fieldKey.replace('field_', ''))] : undefined);
        const { key: groupValKey, displayTitle, badges, isBlank } = parseGroupValue(rawVal, field, relationRowsMap);

        if (!map.has(groupValKey)) {
          map.set(groupValKey, {
            rawVal,
            displayTitle,
            badges,
            isBlank,
            rows: [],
            originalIndices: [],
          });
        }
        const grp = map.get(groupValKey)!;
        grp.rows.push(row);
        grp.originalIndices.push(subIndices[rIdx]);
      });

      const sortedEntries = Array.from(map.entries()).sort(([keyA, dataA], [keyB, dataB]) => {
        if (dataA.isBlank && !dataB.isBlank) return 1;
        if (!dataA.isBlank && dataB.isBlank) return -1;
        const cmp = dataA.displayTitle.localeCompare(dataB.displayTitle, 'zh-TW', { numeric: true });
        return rule.order === 'desc' ? -cmp : cmp;
      });

      return sortedEntries.map(([groupValKey, data]) => {
        const nodeKey = parentPath ? `${parentPath}:::${rule.fieldKey}:${groupValKey}` : `${rule.fieldKey}:${groupValKey}`;
        const currentValues = { ...parentValues, [rule.fieldKey]: data.rawVal };
        const hasNextLevel = level + 1 < effectiveGroupByRules.length;
        const subGroups = hasNextLevel
          ? buildTree(data.rows, data.originalIndices, level + 1, nodeKey, currentValues)
          : undefined;

        return {
          key: nodeKey,
          fieldKey: rule.fieldKey,
          field,
          level,
          displayTitle: data.displayTitle,
          badges: data.badges,
          isBlank: data.isBlank,
          rows: data.rows,
          originalIndices: data.originalIndices,
          subGroups,
          groupValues: currentValues,
        };
      });
    };

    const initialIndices = rows.map((_, i) => i);
    const result = buildTree(rows, initialIndices, 0, '', {});
    frozenGroupedTreeRef.current = result;
    return result;
  }, [rows, effectiveGroupByRules, fields, relationRowsMap, isEditing]);

  // Backward compatibility alias for single group sections
  const groupedSections = useMemo(() => {
    if (!groupedTree || groupedTree.length === 0) return null;
    return groupedTree.map(node => [node.key, node] as [string, GroupSectionNode]);
  }, [groupedTree]);

  // Flat list of rows according to visible/expanded group sections
  const visualGroupedRows = useMemo(() => {
    if (!groupedTree || groupedTree.length === 0) return null;
    const result: { row: RowData; originalIndex: number }[] = [];

    const traverse = (node: GroupSectionNode) => {
      if (isGroupCollapsed(node.key, activeCollapseState)) return;
      if (node.subGroups && node.subGroups.length > 0) {
        node.subGroups.forEach(traverse);
      } else {
        node.rows.forEach((r, idx) => {
          result.push({ row: r, originalIndex: node.originalIndices[idx] });
        });
      }
    };

    groupedTree.forEach(traverse);
    return result;
  }, [groupedTree, activeCollapseState]);

  const handleNavigateCell = useCallback((rIndex: number, cIndex: number, direction: 'nextRow' | 'prevRow' | 'nextCol' | 'prevCol') => {
    // If at the bottom-most row and pressing down/enter, or at the bottom-right cell and pressing Tab: auto add row!
    if (direction === 'nextRow' && rIndex === rows.length - 1) {
      onAddRow?.();
      return;
    }
    if (direction === 'nextCol' && cIndex === fields.length - 1 && rIndex === rows.length - 1) {
      onAddRow?.();
      return;
    }

    let nextRow = rIndex;
    let nextCol = cIndex;

    if (visualGroupedRows && visualGroupedRows.length > 0) {
      const currentVisualIdx = visualGroupedRows.findIndex(v => v.originalIndex === rIndex);
      if (currentVisualIdx >= 0) {
        let nextVisualIdx = currentVisualIdx;
        if (direction === 'nextRow') nextVisualIdx = Math.min(visualGroupedRows.length - 1, currentVisualIdx + 1);
        if (direction === 'prevRow') nextVisualIdx = Math.max(0, currentVisualIdx - 1);
        nextRow = visualGroupedRows[nextVisualIdx].originalIndex;
      }
    } else {
      if (direction === 'nextRow') nextRow = Math.min(rows.length - 1, rIndex + 1);
      if (direction === 'prevRow') nextRow = Math.max(0, rIndex - 1);
    }

    if (direction === 'nextCol') nextCol = Math.min(fields.length - 1, cIndex + 1);
    if (direction === 'prevCol') nextCol = Math.max(0, cIndex - 1);

    const targetRow = rows[nextRow];
    setSelectedCell([nextRow, nextCol]);
    setSelectionStart([nextRow, nextCol]);
    setSelectionEnd([nextRow, nextCol]);

    if (direction === 'nextRow' && nextRow !== rIndex) {
      if (targetRow) setEditingCellInfo({ rowId: targetRow.id, colIndex: nextCol });
      setTimeout(() => {
        setIsEditing(true);
      }, 50);
    } else {
      setIsEditing(false);
      setEditingCellInfo(null);
    }
  }, [rows, fields.length, visualGroupedRows, onAddRow]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputTarget = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"], [role="dialog"], .modal'))
      );
      if (isEditing || isInputTarget) return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        Promise.resolve(onUndo?.()).then(res => {
          if (res !== false) {
            showToast('已執行復原 (Undo)');
          }
        });
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        Promise.resolve(onRedo?.()).then(res => {
          if (res !== false) {
            showToast('已執行重做 (Redo)');
          }
        });
      }

      // Copy: Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopySelection();
      }

      // Cut: Ctrl+X / Cmd+X
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        handleCutSelection();
      }

      // Paste: Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        handlePasteSelection();
      }

      // Clear values: Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionBounds) {
        handleClearSelectionValues();
      }

      // Keyboard Arrow Keys Navigation & Shift Range Expansion
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectionStart) {
        e.preventDefault();
        const currRow = selectionEnd ? selectionEnd[0] : selectionStart[0];
        const currCol = selectionEnd ? selectionEnd[1] : selectionStart[1];
        let nextRow = currRow;
        let nextCol = currCol;

        if (visualGroupedRows && visualGroupedRows.length > 0) {
          const currentVisualIdx = visualGroupedRows.findIndex(v => v.originalIndex === currRow);
          if (currentVisualIdx >= 0) {
            let nextVisualIdx = currentVisualIdx;
            if (e.key === 'ArrowUp') nextVisualIdx = Math.max(0, currentVisualIdx - 1);
            if (e.key === 'ArrowDown') nextVisualIdx = Math.min(visualGroupedRows.length - 1, currentVisualIdx + 1);
            nextRow = visualGroupedRows[nextVisualIdx].originalIndex;
          }
        } else {
          if (e.key === 'ArrowUp') nextRow = Math.max(0, currRow - 1);
          if (e.key === 'ArrowDown') nextRow = Math.min(rows.length - 1, currRow + 1);
        }

        if (e.key === 'ArrowLeft') nextCol = Math.max(0, currCol - 1);
        if (e.key === 'ArrowRight') nextCol = Math.min(fields.length - 1, currCol + 1);

        if (e.shiftKey) {
          setSelectionEnd([nextRow, nextCol]);
        } else {
          setSelectionStart([nextRow, nextCol]);
          setSelectionEnd([nextRow, nextCol]);
          setSelectedCell([nextRow, nextCol]);
          setEditingCellInfo(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, selectionBounds, selectionStart, selectionEnd, rows, fields, handleCopySelection, handleCutSelection, handlePasteSelection, handleClearSelectionValues, visualGroupedRows]);

  // Ensure Row 1 (index 0) is visible at top on initial mount or table switch
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [tableId]);

  const isAllRowsSelected = useMemo(() => {
    if (rows.length === 0) return false;
    return rows.every(r => selectedRowIds.has(r.id));
  }, [rows, selectedRowIds]);

  const isSomeRowsSelected = useMemo(() => {
    return selectedRowIds.size > 0 || Boolean(selectionBounds);
  }, [selectedRowIds.size, selectionBounds]);

  const handleToggleSelectAllRows = useCallback(() => {
    if (isAllRowsSelected) {
      setSelectedRowIds(new Set());
      setSelectionStart(null);
      setSelectionEnd(null);
      setSelectedCell(null);
    } else {
      const allIds = new Set(rows.map(r => r.id));
      setSelectedRowIds(allIds);
      setSelectionStart([0, 0]);
      setSelectionEnd([Math.max(0, rows.length - 1), Math.max(0, fields.length - 1)]);
    }
  }, [isAllRowsSelected, rows, fields.length]);

  const handleToggleRowCheckbox = useCallback((rowId: number, e?: React.MouseEvent) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const handleSelectRowHeader = useCallback((rIndex: number, e?: React.MouseEvent) => {
    const targetRow = rows[rIndex];
    if (targetRow && (e?.ctrlKey || e?.metaKey)) {
      handleToggleRowCheckbox(targetRow.id, e);
      return;
    }

    if (e?.shiftKey && selectionStart) {
      const minR = Math.min(selectionStart[0], rIndex);
      const maxR = Math.max(selectionStart[0], rIndex);
      setSelectionStart([minR, 0]);
      setSelectionEnd([maxR, Math.max(0, fields.length - 1)]);
      
      const newSelectedIds = new Set(selectedRowIds);
      for (let i = minR; i <= maxR; i++) {
        if (rows[i]) newSelectedIds.add(rows[i].id);
      }
      setSelectedRowIds(newSelectedIds);
    } else {
      if (targetRow) {
        if (selectedRowIds.has(targetRow.id) && selectedRowIds.size === 1) {
          setSelectedRowIds(new Set());
          setSelectionStart(null);
          setSelectionEnd(null);
          setSelectedCell(null);
        } else {
          setSelectionStart([rIndex, 0]);
          setSelectionEnd([rIndex, Math.max(0, fields.length - 1)]);
          setSelectedCell([rIndex, 0]);
          setIsDraggingSelection(true);
          setIsEditing(false);
          setSelectedRowIds(new Set([targetRow.id]));
        }
      }
    }
  }, [selectionStart, fields.length, rows, selectedRowIds, handleToggleRowCheckbox]);

  const handleMouseEnterRowHeader = useCallback((rIndex: number, e?: React.MouseEvent) => {
    if (e && e.buttons !== 1) {
      setIsDraggingSelection(false);
      return;
    }
    if (isDraggingSelection && selectionStart) {
      setSelectionEnd([rIndex, Math.max(0, fields.length - 1)]);
      const minR = Math.min(selectionStart[0], rIndex);
      const maxR = Math.max(selectionStart[0], rIndex);
      const newSelectedIds = new Set(selectedRowIds);
      for (let i = minR; i <= maxR; i++) {
        if (rows[i]) newSelectedIds.add(rows[i].id);
      }
      setSelectedRowIds(newSelectedIds);
    }
  }, [isDraggingSelection, selectionStart, rows, selectedRowIds, fields.length]);

  const getRowHeightPx = useCallback(() => {
    if (typeof window !== 'undefined' && containerRef.current) {
      const val = getComputedStyle(containerRef.current).getPropertyValue('--row-height').trim();
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 32;
  }, []);

  // Virtualizer for high-performance rendering of 10,000+ rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: getRowHeightPx,
    overscan: 10,
  });

  // Watch for --row-height CSS variable mutations and force virtualizer remeasure
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const remeasureVirtualizer = () => {
      rowVirtualizer.measure();
    };

    // Initial remeasure
    remeasureVirtualizer();

    const targetNodes = [
      containerRef.current,
      containerRef.current?.parentElement,
      document.documentElement,
      document.body,
    ].filter(Boolean) as HTMLElement[];

    const observer = new MutationObserver(() => {
      remeasureVirtualizer();
    });

    targetNodes.forEach(node => {
      observer.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
    });

    return () => {
      observer.disconnect();
    };
  }, [rowVirtualizer]);

  // Auto scroll to selected cell row when selectedCell changes (ONLY in flat non-grouped view)
  useEffect(() => {
    if (selectedCell && rowVirtualizer && (!effectiveGroupByRules || effectiveGroupByRules.length === 0)) {
      rowVirtualizer.scrollToIndex(selectedCell[0], { align: 'auto' });
    }
  }, [selectedCell, rowVirtualizer, effectiveGroupByRules]);

  const handleResizeColumnLocal = useCallback((fieldId: number, newWidth: number) => {
    if (containerRef.current) {
      containerRef.current.style.setProperty(`--field-width-${fieldId}`, `${newWidth}px`);
    }
  }, []);

  useOnClickOutside(containerRef, () => {
    setSelectedCell(null);
    setIsEditing(false);
  });



  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell) return;

      const [r, c] = selectedCell;

      if (isEditing) {
        if (e.key === 'Escape') {
          setIsEditing(false);
        }
        return;
      }

      // Enter or F2 starts editing
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setIsEditing(true);
        return;
      }

      // Arrow navigation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (r > 0) setSelectedCell([r - 1, c]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (r < rows.length - 1) setSelectedCell([r + 1, c]);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (c > 0) setSelectedCell([r, c - 1]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (c < fields.length - 1) setSelectedCell([r, c + 1]);
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            if (c > 0) setSelectedCell([r, c - 1]);
          } else {
            if (c < fields.length - 1) setSelectedCell([r, c + 1]);
          }
          break;
      }
    },
    [selectedCell, isEditing, fields.length, rows.length]
  );

  const storageKey = useMemo(() => {
    if (tableId && viewId) return `grid_agg_modes_${tableId}_${viewId}`;
    if (tableId) return `grid_agg_modes_${tableId}`;
    return null;
  }, [tableId, viewId]);

  const parseAggregations = useCallback((raw: any): Record<number, string> => {
    if (!raw) return {};
    try {
      let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const result: Record<number, string> = {};
        Object.entries(parsed).forEach(([k, v]) => {
          const numKey = Number(k);
          if (!isNaN(numKey) && typeof v === 'string') {
            result[numKey] = v;
          }
        });
        return result;
      }
    } catch {}
    return {};
  }, []);

  // Column aggregation mode selection state with Database View + localStorage hybrid persistence
  const [aggregationModes, setAggregationModes] = useState<Record<number, string>>(() => {
    const fromView = parseAggregations(initialAggregations);
    if (Object.keys(fromView).length > 0) return fromView;

    if (typeof window !== 'undefined' && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved aggregation modes', e);
      }
    }
    return {};
  });

  // Re-sync when tableId, viewId, or database initialAggregations change
  useEffect(() => {
    const fromView = parseAggregations(initialAggregations);
    if (Object.keys(fromView).length > 0) {
      setAggregationModes(fromView);
      if (typeof window !== 'undefined' && storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(fromView));
        } catch {}
      }
      return;
    }

    if (typeof window !== 'undefined' && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setAggregationModes(JSON.parse(saved));
        } else {
          setAggregationModes({});
        }
      } catch (e) {
        console.error('Failed to load saved aggregation modes', e);
      }
    }
  }, [storageKey, initialAggregations, parseAggregations]);

  const handleSelectAggregationMode = useCallback((fieldId: number, newMode: string) => {
    setAggregationModes(prev => {
      const next = { ...prev, [fieldId]: newMode };
      if (typeof window !== 'undefined' && storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.error('Failed to save aggregation modes', e);
        }
      }
      onUpdateAggregations?.(next);
      return next;
    });
  }, [storageKey, onUpdateAggregations]);

  const [aggMenuState, setAggMenuState] = useState<{ fieldId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!aggMenuState) return;
    const handleGlobalClick = () => setAggMenuState(null);
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('scroll', handleGlobalClick, true);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('scroll', handleGlobalClick, true);
    };
  }, [aggMenuState]);

  // Advanced Aggregation summaries for whole table
  const fieldSummaries = useMemo(() => {
    return computeFieldSummaries(rows, fields);
  }, [fields, rows]);

  // Group-level field summaries
  const groupSummariesMap = useMemo(() => {
    if (!groupedSections) return null;
    const map = new Map<string, Record<number, any>>();
    groupedSections.forEach(([groupKey, groupData]) => {
      map.set(groupKey, computeFieldSummaries(groupData.rows, fields));
    });
    return map;
  }, [groupedSections, fields]);


  const formatGroupSummaryText = useCallback((summary: any, mode: string) => {
    if (!summary || mode === 'none') return '';
    if (mode === 'count') return `${summary.count || 0}`;
    if (mode === 'empty_count') return `${summary.emptyCount || 0}`;
    if (mode === 'percent') return `${summary.percentFilled || 0}%`;
    if (mode === 'sum') return summary.sum !== null ? `Σ ${summary.sum}` : `${summary.count || 0}`;
    if (mode === 'avg') return summary.avg !== null ? `x̄ ${summary.avg}` : `${summary.count || 0}`;
    if (mode === 'min') return summary.min !== null ? `Min ${summary.min}` : '-';
    if (mode === 'max') return summary.max !== null ? `Max ${summary.max}` : '-';
    if (mode === 'unique') return `${summary.uniqueCount || 0}`;
    return '';
  }, []);

  const fieldsWidth = useMemo(() => {
    return fields.reduce((sum, f) => sum + (f.width || 180), rowDetailsWidth);
  }, [fields, rowDetailsWidth]);

  const totalTableWidth = useMemo(() => {
    // 100px for add field button + 100px buffer space, matching Baserow
    return fieldsWidth + 100 + 100;
  }, [fieldsWidth]);

  const canDragRows = useMemo(() => {
    return (!sortField || sortField === '') && (!sortRules || sortRules.length === 0);
  }, [sortField, sortRules]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="grid-view"
      style={{ outline: 'none', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Single Unified GPU Scroll Container (Natively synchronizes Head, Rows, and Footer) */}
      <div 
        ref={bodyRef}
        className="grid-view__scroll-container"
        onScroll={(e) => {
          if (footerScrollRef.current) {
            footerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
        onContextMenu={(e) => {
          if (selectionBounds) {
            e.preventDefault();
            setCellContextMenu({ x: e.clientX, y: e.clientY });
          }
        }}
        style={{ flex: 1, overflow: 'auto', width: '100%', minHeight: 0, position: 'relative', background: '#fafaf9' }}
      >
        <div style={{ minWidth: '100%', width: `${totalTableWidth}px`, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          {/* 1. Header (Sticky Top: 0 inside unified scroll container) */}
          <div
            ref={headerScrollRef}
            className="grid-view__head-container"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 35,
              width: `${totalTableWidth}px`,
              background: '#ffffff',
              boxSizing: 'border-box',
            }}
          >
            <GridViewHead
              fields={fields}
              rowDetailsWidth={rowDetailsWidth}
              sortField={sortField}
              sortOrder={sortOrder}
              isAllRowsSelected={isAllRowsSelected}
              isSomeRowsSelected={isSomeRowsSelected}
              onToggleSelectAllRows={handleToggleSelectAllRows}
              onAddField={onAddField}
              onAddFieldPopover={onAddFieldPopover}
              onResizeColumn={handleResizeColumnLocal}
              onResizeColumnEnd={onResizeColumnEnd}
              onFieldClick={onFieldClick}
              onOpenFieldContextMenu={onOpenFieldContextMenu}
              onReorderFields={onReorderFields}
              totalTableWidth={totalTableWidth}
            />
          </div>

          {/* 2. Rows Body */}
          <div className="grid-view__body-inner" style={{ flex: 1, width: `${totalTableWidth}px`, minWidth: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            {groupedTree && groupedTree.length > 0 ? (
              <div className="grid-view__grouped-body" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const renderGroupNode = (node: GroupSectionNode): React.ReactNode => {
                    const isCollapsed = isGroupCollapsed(node.key, activeCollapseState);
                    const groupSummaries = computeFieldSummaries(node.rows, fields);
                    const isTopLevel = node.level === 0;

                    return (
                      <div key={node.key} className="grid-view__group-section" style={{ width: '100%', marginBottom: isTopLevel ? '12px' : '4px' }}>
                        {/* Group By Banner (Aligned with Table Columns) */}
                        <div
                          className="grid-view__group-by-banner"
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'stretch',
                            height: isTopLevel ? '38px' : '34px',
                            backgroundColor: isTopLevel
                              ? (isCollapsed ? '#f1f5f9' : '#f8fafc')
                              : (isCollapsed ? '#f8fafc' : '#ffffff'),
                            borderTop: '1px solid #e2e8f0',
                            borderBottom: '1px solid #cbd5e1',
                            width: `${totalTableWidth}px`,
                            minWidth: '100%',
                            boxSizing: 'border-box',
                            userSelect: 'none',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* Primary Group Info Column (Sticky Left: 0, Auto-expanding so Field Name & Badges are NEVER clipped) */}
                          <div
                            onClick={() => handleToggleGroup(node.key)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              height: '100%',
                              minWidth: `${rowDetailsWidth + (fields[0]?.width || 180)}px`,
                              maxWidth: '85%',
                              paddingLeft: `${8 + node.level * 22}px`,
                              paddingRight: '14px',
                              position: 'sticky',
                              left: 0,
                              zIndex: 22 - node.level,
                              backgroundColor: isTopLevel
                                ? (isCollapsed ? '#f1f5f9' : '#f8fafc')
                                : (isCollapsed ? '#f8fafc' : '#ffffff'),
                              borderLeft: isTopLevel ? '4px solid #3F6212' : '3px solid #84cc16',
                              borderRight: '1px solid #cbd5e1',
                              boxShadow: '3px 0 6px -2px rgba(0, 0, 0, 0.08)',
                              boxSizing: 'border-box',
                              cursor: 'pointer',
                              gap: '8px',
                              flexShrink: 0,
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isTopLevel ? (isCollapsed ? '#f1f5f9' : '#f8fafc') : (isCollapsed ? '#f8fafc' : '#ffffff')}
                            title={isCollapsed ? '點擊展開分組' : '點擊折疊分組'}
                          >
                            {/* Chevron Toggle Button */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                transition: 'transform 0.15s ease',
                                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                color: '#475569',
                                flexShrink: 0,
                              }}
                            >
                              <ChevronDown size={isTopLevel ? 14 : 13} />
                            </div>

                            {/* Group Field Name */}
                            {node.field && (
                              <span style={{ fontSize: isTopLevel ? '12px' : '11px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                                {isTopLevel ? `${node.field.name}:` : `Then by ${node.field.name}:`}
                              </span>
                            )}

                            {/* Group Value Badges */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                              {node.badges.length > 0 ? (
                                node.badges.map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: isTopLevel ? '2px 8px' : '1px 6px',
                                      borderRadius: '6px',
                                      fontSize: isTopLevel ? '12px' : '11px',
                                      fontWeight: 600,
                                      backgroundColor: b.bg || '#f1f5f9',
                                      color: b.color || '#334155',
                                      border: `1px solid ${b.border || 'transparent'}`,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={b.label}
                                  >
                                    {b.label}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  （空白未指定）
                                </span>
                              )}
                            </div>

                            {/* Row Count Badge */}
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#475569',
                                fontWeight: 600,
                                backgroundColor: '#e2e8f0',
                                padding: '1px 8px',
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                flexShrink: 0,
                                marginLeft: '4px',
                              }}
                            >
                              {node.rows.length} 筆
                            </span>
                          </div>

                          {/* Group Field Aggregation Cells (Columns 1..N) */}
                          {fields.slice(1).map((field) => {
                            const summary = groupSummaries?.[field.id];
                            const mode = aggregationModes[field.id] || (field.type === 'number' || field.type === 'rating' ? 'sum' : 'none');
                            const displayText = formatGroupSummaryText(summary, mode);

                            return (
                              <div
                                key={field.id}
                                style={{
                                  width: `var(--field-width-${field.id}, ${field.width || 180}px)`,
                                  minWidth: `var(--field-width-${field.id}, ${field.width || 180}px)`,
                                  maxWidth: `var(--field-width-${field.id}, ${field.width || 180}px)`,
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  padding: '0 10px',
                                  borderRight: '1px solid #f1f5f9',
                                  boxSizing: 'border-box',
                                  backgroundColor: 'inherit',
                                }}
                              >
                                {displayText ? (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: '#334155',
                                      fontFamily: 'monospace',
                                      backgroundColor: '#e2e8f0',
                                      padding: '2px 7px',
                                      borderRadius: '5px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      border: '1px solid #cbd5e1',
                                    }}
                                  >
                                    {displayText}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}

                          {/* Trailing Spacer */}
                          <div style={{ flex: 1, backgroundColor: 'inherit', minWidth: '90px' }} />
                        </div>

                        {/* Children: Subgroups or Leaf Rows */}
                        {!isCollapsed && (
                          <>
                            {node.subGroups && node.subGroups.length > 0 ? (
                              <div className="grid-view__sub-groups" style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: '4px' }}>
                                {node.subGroups.map(subNode => renderGroupNode(subNode))}
                              </div>
                            ) : (
                              <div className="grid-view__grouped-rows" style={{ display: 'flex', flexDirection: 'column' }}>
                                {node.rows.map((row: RowData, inGrpIdx: number) => {
                                  const rIndex = node.originalIndices[inGrpIdx];
                                  return (
                                    <GridViewRow
                                      key={row.id}
                                      row={row}
                                      rowIndex={rIndex >= 0 ? rIndex : 0}
                                      fields={fields}
                                      rowColorRules={rowColorRules}
                                      rowDetailsWidth={rowDetailsWidth}
                                      selectedColumnIndex={editingCellInfo && editingCellInfo.rowId === row.id ? editingCellInfo.colIndex : (selectedCell?.[0] === rIndex ? selectedCell[1] : null)}
                                      isCellEditing={isEditing && (editingCellInfo ? editingCellInfo.rowId === row.id : selectedCell?.[0] === rIndex)}
                                      selectionBounds={selectionBounds}
                                      isRowSelectedDirectly={selectedRowIds.has(row.id)}
                                      canDrag={canDragRows}
                                      onToggleRowCheckbox={handleToggleRowCheckbox}
                                      onSelectRowHeader={handleSelectRowHeader}
                                      onMouseEnterRowHeader={handleMouseEnterRowHeader}
                                      onSelectCell={(cIndex, e) => {
                                        if (e?.shiftKey && selectedCell) {
                                          setSelectionStart(selectedCell);
                                          setSelectionEnd([rIndex, cIndex]);
                                        } else {
                                          setSelectedCell([rIndex, cIndex]);
                                          setSelectionStart([rIndex, cIndex]);
                                          setSelectionEnd([rIndex, cIndex]);
                                        }
                                        setIsEditing(false);
                                        setEditingCellInfo(null);
                                      }}
                                      onMouseEnterCell={(cIndex) => {
                                        if (isDraggingSelection && selectionStart) {
                                          setSelectionEnd([rIndex, cIndex]);
                                        }
                                      }}
                                      onStartAutofillCell={(cIndex, e) => {
                                        e.stopPropagation();
                                        setIsAutofilling(true);
                                        setAutofillStart([rIndex, cIndex]);
                                        setAutofillEnd([rIndex, cIndex]);
                                        setSelectionStart([rIndex, cIndex]);
                                        setSelectionEnd([rIndex, cIndex]);
                                      }}
                                      onStartEditCell={(cIndex) => {
                                        setSelectedCell([rIndex, cIndex]);
                                        setEditingCellInfo({ rowId: row.id, colIndex: cIndex });
                                        setIsEditing(true);
                                      }}
                                      onUpdateCell={(fieldId, val) => {
                                        onUpdateCell?.(row.id, fieldId, val);
                                      }}
                                      onUpdateField={onUpdateField}
                                      onCancelEditCell={() => {
                                        setIsEditing(false);
                                        setEditingCellInfo(null);
                                      }}
                                      onExpandRow={() => onExpandRow?.(row.id)}
                                      onReorderRows={onReorderRows}
                                      onNavigateCell={(cIndex, dir) => handleNavigateCell(rIndex, cIndex, dir)}
                                    />
                                  );
                                })}
                                {/* Group-specific Add Row Bar */}
                                <div
                                  className="grid-view__group-add-row-bar"
                                  onClick={() => {
                                    if (onBatchAddRows) {
                                      onBatchAddRows([node.groupValues]);
                                    } else {
                                      onAddRow?.();
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    height: '32px',
                                    width: `${fieldsWidth}px`,
                                    borderBottom: '1px solid #e2e8f0',
                                    background: '#ffffff',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box',
                                    transition: 'background 0.15s ease',
                                    paddingLeft: `${node.level * 16}px`,
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                  onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                >
                                  <div
                                    style={{
                                      width: `${rowDetailsWidth}px`,
                                      minWidth: `${rowDetailsWidth}px`,
                                      maxWidth: `${rowDetailsWidth}px`,
                                      height: '100%',
                                      position: 'sticky',
                                      left: 0,
                                      zIndex: 15,
                                      background: 'inherit',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRight: '1px solid #e2e8f0',
                                      color: '#94a3b8',
                                      fontSize: '14px',
                                    }}
                                  >
                                    +
                                  </div>
                                  <div
                                    style={{
                                      paddingLeft: '12px',
                                      fontSize: '12px',
                                      color: '#64748b',
                                      fontWeight: 500,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    + 在「{node.isBlank ? '未指定' : node.displayTitle}」新增資料列
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  };

                  return groupedTree.map(renderGroupNode);
                })()}
              </div>
            ) : (
              <div
                className="grid-view__rows"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: `${fieldsWidth}px`,
                  position: 'relative',
                  userSelect: isDraggingSelection ? 'none' : 'auto'
                }}
              >
                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const rIndex = virtualRow.index;
                  return (
                    <div
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${fieldsWidth}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        zIndex: selectedCell?.[0] === rIndex && isEditing ? 100 : (selectedCell?.[0] === rIndex ? 10 : 1),
                      }}
                    >
                      <GridViewRow
                        row={row}
                        rowIndex={rIndex}
                        fields={fields}
                        rowColorRules={rowColorRules}
                        rowDetailsWidth={rowDetailsWidth}
                        selectedColumnIndex={editingCellInfo && editingCellInfo.rowId === row.id ? editingCellInfo.colIndex : (selectedCell?.[0] === rIndex ? selectedCell[1] : null)}
                        isCellEditing={isEditing && (editingCellInfo ? editingCellInfo.rowId === row.id : selectedCell?.[0] === rIndex)}
                        selectionBounds={selectionBounds}
                        isRowSelectedDirectly={selectedRowIds.has(row.id)}
                        canDrag={canDragRows}
                        onToggleRowCheckbox={handleToggleRowCheckbox}
                        onSelectRowHeader={handleSelectRowHeader}
                        onMouseEnterRowHeader={handleMouseEnterRowHeader}
                        onSelectCell={(cIndex, e) => {
                          if (e?.shiftKey && selectedCell) {
                            setSelectionStart(selectedCell);
                            setSelectionEnd([rIndex, cIndex]);
                          } else {
                            setSelectedCell([rIndex, cIndex]);
                            setSelectionStart([rIndex, cIndex]);
                            setSelectionEnd([rIndex, cIndex]);
                            setIsDraggingSelection(true);
                          }
                          setIsEditing(false);
                          setEditingCellInfo(null);
                        }}
                        onMouseEnterCell={(cIndex) => {
                          if (isDraggingSelection && selectionStart) {
                            setSelectionEnd([rIndex, cIndex]);
                          }
                        }}
                        onStartAutofillCell={(cIndex, e) => {
                          e.stopPropagation();
                          setIsAutofilling(true);
                          setAutofillStart([rIndex, cIndex]);
                          setAutofillEnd([rIndex, cIndex]);
                          setSelectionStart([rIndex, cIndex]);
                          setSelectionEnd([rIndex, cIndex]);
                        }}
                        onStartEditCell={(cIndex) => {
                          setSelectedCell([rIndex, cIndex]);
                          setEditingCellInfo({ rowId: row.id, colIndex: cIndex });
                          setIsEditing(true);
                        }}
                        onUpdateCell={(fieldId, val) => {
                          onUpdateCell?.(row.id, fieldId, val);
                        }}
                        onUpdateField={onUpdateField}
                        onCancelEditCell={() => {
                          setIsEditing(false);
                          setEditingCellInfo(null);
                        }}
                        onExpandRow={() => onExpandRow?.(row.id)}
                        onReorderRows={onReorderRows}
                        onNavigateCell={(cIndex, dir) => handleNavigateCell(rIndex, cIndex, dir)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Baserow Add Row Bar (Full width table row entry matching row length) */}
            <div
              className="grid-view__add-row-bar"
              onClick={() => onAddRow?.()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBatchAddMenuPosition({ top: e.clientY, left: e.clientX });
              }}
              style={{
                display: 'flex',
                width: `${fieldsWidth}px`,
                height: 'var(--row-height, 33px)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                borderRight: '1px solid var(--border-color, #e2e8f0)',
                background: '#ffffff',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 0.15s ease',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              {/* Sticky Column 0 for Add Row */}
              <div
                style={{
                  width: `${rowDetailsWidth}px`,
                  position: 'sticky',
                  left: 0,
                  zIndex: 15,
                  background: 'inherit',
                  borderRight: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#18181B',
                  boxSizing: 'border-box',
                }}
              >
                <Plus style={{ width: '14px', height: '14px' }} />
              </div>

              {/* Add row text spanning remaining width matching row length */}
              <div
                style={{
                  width: `${fieldsWidth - rowDetailsWidth}px`,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '12px',
                  fontSize: '13px',
                  color: '#18181B',
                  fontWeight: 500,
                  boxSizing: 'border-box',
                }}
              >
                新增資料列（右鍵可批次新增）
              </div>
            </div>

            {/* Scroll padding area below table */}
            <div style={{ height: '20px', width: '100%' }} />
          </div>

          {/* 3. Sticky Bottom Summary Footer Bar (Height: 38px + 6px Scrollbar = 44px matching Sidebar) */}
          <div
            ref={footerScrollRef}
            className="grid-view__footer-container"
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 35,
              flexShrink: 0,
              width: `${totalTableWidth}px`,
              height: '38px',
              minHeight: '38px',
              maxHeight: '38px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 -2px 10px rgba(15, 23, 42, 0.04)',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="grid-view__summary-bar"
              style={{
                display: 'flex',
                height: '38px',
                width: `${totalTableWidth}px`,
                boxSizing: 'border-box',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              <div style={{
                width: `${rowDetailsWidth}px`,
                minWidth: `${rowDetailsWidth}px`,
                maxWidth: `${rowDetailsWidth}px`,
                boxSizing: 'border-box',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'sticky',
                left: 0,
                zIndex: 25,
                flexShrink: 0,
                padding: '0 8px',
                textAlign: 'center',
                fontWeight: 600,
                borderRight: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#18181B'
              }}>
                {rows.length} 筆
              </div>

              {fields.map((field, fieldIndex) => {
                const summary = fieldSummaries[field.id];
                const mode = aggregationModes[field.id] || (field.type === 'number' || field.type === 'rating' ? 'sum' : 'count');
                return (
                  <GridViewFieldFooter
                    key={field.id}
                    field={field}
                    fieldIndex={fieldIndex}
                    rowDetailsWidth={rowDetailsWidth}
                    summaryData={summary}
                    totalRowCount={rows.length}
                    aggregationMode={mode}
                    onSelectAggregationMode={(fieldId, newMode) => {
                      handleSelectAggregationMode(fieldId, newMode);
                    }}
                  />
                );
              })}
              {/* Footer Right Extension Area (Clean seamless canvas without fake dividing lines) */}
              <div
                style={{
                  width: '200px',
                  minWidth: '200px',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  background: '#ffffff'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Batch Add Rows Popover Menu */}
      {batchAddMenuPosition && (
        <PopoverPortal
          show={Boolean(batchAddMenuPosition)}
          onClose={() => setBatchAddMenuPosition(null)}
          position={batchAddMenuPosition}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              padding: '4px',
              minWidth: '180px',
              fontSize: '13px',
              color: '#334155'
            }}
          >
            <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
              新增資料列
            </div>
            <div
              onClick={() => { onAddRow?.(); setBatchAddMenuPosition(null); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={14} /> 建立 1 列
            </div>
            <div
              onClick={() => { onBatchAddRows?.(Array(5).fill({})); setBatchAddMenuPosition(null); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={14} /> 批次建立 5 列
            </div>
            <div
              onClick={() => { onBatchAddRows?.(Array(10).fill({})); setBatchAddMenuPosition(null); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={14} /> 批次建立 10 列
            </div>
            <div
              onClick={() => { onBatchAddRows?.(Array(50).fill({})); setBatchAddMenuPosition(null); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={14} /> 批次建立 50 列
            </div>
          </div>
        </PopoverPortal>
      )}

      {cellContextMenu && (selectionBounds || selectedRowIds.size > 0) && (
        <MultiCellContextMenu
          x={cellContextMenu.x}
          y={cellContextMenu.y}
          selectedCellCount={
            selectedRowIds.size > 0
              ? selectedRowIds.size * fields.length
              : selectionBounds
              ? (selectionBounds.maxRow - selectionBounds.minRow + 1) * (selectionBounds.maxCol - selectionBounds.minCol + 1)
              : 0
          }
          selectedRowCount={
            selectedRowIds.size > 0
              ? selectedRowIds.size
              : selectionBounds
              ? selectionBounds.maxRow - selectionBounds.minRow + 1
              : 0
          }
          onClose={() => setCellContextMenu(null)}
          onCopy={handleCopySelection}
          onCut={handleCutSelection}
          onPaste={handlePasteSelection}
          onClearValues={handleClearSelectionValues}
          onDeleteRows={handleDeleteSelectedRows}
        />
      )}

      {/* Global Aggregation Menu Portal */}
      {aggMenuState && (() => {
        const targetField = fields.find(f => f.id === aggMenuState.fieldId);
        if (!targetField) return null;
        const isNumeric = targetField.type === 'number' || targetField.type === 'rating';
        const currentMode = aggregationModes[targetField.id] || (isNumeric ? 'sum' : 'count');

        return createPortal(
          <div
            data-grid-portal="true"
            style={{
              position: 'fixed',
              left: `${aggMenuState.x}px`,
              bottom: `${window.innerHeight - aggMenuState.y + 4}px`,
              width: '180px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
              zIndex: 999999,
              padding: '6px 0',
              fontSize: '12px',
              color: '#334155',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '4px 12px 6px 12px', fontSize: '11px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
              【{targetField.name}】統計方式
            </div>
            {[
              { key: 'count', label: '已填寫筆數 (Count)' },
              { key: 'empty_count', label: '未填寫筆數 (Empty)' },
              { key: 'percent', label: '填寫百分比 (%)' },
              ...(isNumeric ? [
                { key: 'sum', label: '總和 (Sum)' },
                { key: 'avg', label: '平均值 (Average)' },
              ] : []),
              { key: 'min', label: '最小值 (Min)' },
              { key: 'max', label: '最大值 (Max)' },
              { key: 'unique', label: '不重複項目數 (Unique)' },
              { key: 'none', label: '不顯示 (None)' },
            ].map((item) => (
              <div
                key={item.key}
                onClick={() => {
                  handleSelectAggregationMode(targetField.id, item.key);
                  setAggMenuState(null);
                }}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  background: currentMode === item.key ? '#f1f5f9' : 'transparent',
                  fontWeight: currentMode === item.key ? 600 : 400,
                  color: currentMode === item.key ? '#3F6212' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{item.label}</span>
                {currentMode === item.key && <span style={{ color: '#18181B', fontWeight: 'bold' }}>✓</span>}
              </div>
            ))}
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
