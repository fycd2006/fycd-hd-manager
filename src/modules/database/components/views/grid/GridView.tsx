'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { TableField, RowColorRule } from '@/modules/database/types';
import { GridViewHead } from './GridViewHead';
import { GridViewRow } from './GridViewRow';
import GridViewFieldFooter from '@/modules/database/components/table/GridViewFieldFooter';
import { MultiCellContextMenu } from '@/modules/database/components/menu/MultiCellContextMenu';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';

export interface RowData {
  id: number;
  order?: number;
  values: Record<number, any>;
}

interface GridViewProps {
  fields: TableField[];
  rows: RowData[];
  sortField?: string | null;
  sortOrder?: 'asc' | 'desc';
  groupByField?: string | null;
  rowColorRules?: RowColorRule[];
  rowDetailsWidth?: number;
  onUpdateCell?: (rowId: number, fieldId: number, value: any) => void;
  onAddRow?: () => void;
  onAddField?: () => void;
  onResizeColumn?: (fieldId: number, newWidth: number) => void;
  onResizeColumnEnd?: (fieldId: number, newWidth: number) => void;
  onExpandRow?: (rowId: number) => void;
  onDeleteRow?: (rowId: number) => void;
  onFieldClick?: (field: TableField, e: React.MouseEvent) => void;
  onOpenFieldContextMenu?: (field: TableField, x: number, y: number) => void;
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onReorderFields?: (sourceFieldId: number, targetFieldId: number) => void;
  onReorderRows?: (sourceRowIndex: number, targetRowIndex: number) => void;
}

export const GridView: React.FC<GridViewProps> = ({
  fields,
  rows,
  sortField,
  sortOrder,
  groupByField,
  rowColorRules,
  rowDetailsWidth = 56,
  onUpdateCell,
  onAddRow,
  onAddField,
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
}) => {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

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
            const val = row.values?.[field.id] ?? (row as any).data?.[`field_${field.id}`] ?? (row as any).data?.[field.id] ?? '';
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
          const val = row.values?.[field.id] ?? (row as any).data?.[`field_${field.id}`] ?? (row as any).data?.[field.id] ?? '';
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
    if (selectedRowIds.size > 0) {
      rows.forEach((row) => {
        if (selectedRowIds.has(row.id)) {
          fields.forEach((field) => {
            onUpdateCell?.(row.id, field.id, null);
          });
        }
      });
      showToast('已清空選取列內容');
    } else if (selectionBounds) {
      for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
        for (let c = selectionBounds.minCol; c <= selectionBounds.maxCol; c++) {
          const targetRow = rows[r];
          const targetField = fields[c];
          if (targetRow && targetField) {
            onUpdateCell?.(targetRow.id, targetField.id, null);
          }
        }
      }
      showToast('已清空選取儲存格內容');
    }
  }, [selectedRowIds, selectionBounds, rows, fields, onUpdateCell, showToast]);

  const handleDeleteSelectedRows = useCallback(() => {
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

    if (selectionBounds && selectionBounds.isMulti) {
      // Batch paste into multi-cell selection bounds (repeating/tiling if pasted content is smaller than selection area)
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
            onUpdateCell?.(targetRow.id, targetField.id, cellVal.trim());
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
            onUpdateCell?.(targetRow.id, targetField.id, cellVal.trim());
          }
        });
      });
    }
  }, [selectionBounds, selectionStart, rows, fields, onUpdateCell]);

  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      if (isEditing) return;
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

          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              const rData = rows[r];
              const fData = fields[c];
              if (rData && fData) {
                onUpdateCell?.(rData.id, fData.id, sourceValue);
              }
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
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isAutofilling, autofillStart, autofillEnd, rows, fields, onUpdateCell]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo?.();
        showToast('已執行復原 (Undo)');
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        onRedo?.();
        showToast('已執行重做 (Redo)');
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

        if (e.key === 'ArrowUp') nextRow = Math.max(0, currRow - 1);
        if (e.key === 'ArrowDown') nextRow = Math.min(rows.length - 1, currRow + 1);
        if (e.key === 'ArrowLeft') nextCol = Math.max(0, currCol - 1);
        if (e.key === 'ArrowRight') nextCol = Math.min(fields.length - 1, currCol + 1);

        if (e.shiftKey) {
          setSelectionEnd([nextRow, nextCol]);
        } else {
          setSelectionStart([nextRow, nextCol]);
          setSelectionEnd([nextRow, nextCol]);
          setSelectedCell([nextRow, nextCol]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, selectionBounds, selectionStart, selectionEnd, rows, fields, handleCopySelection, handleCutSelection, handlePasteSelection, handleClearSelectionValues]);

  const groupedField = useMemo(() => {
    if (!groupByField) return null;
    return fields.find(f => `field_${f.id}` === groupByField);
  }, [fields, groupByField]);

  const groupedSections = useMemo(() => {
    if (!groupByField) return null;
    const map = new Map<string, { rows: RowData[]; originalIndices: number[] }>();
    rows.forEach((row, idx) => {
      const rawVal = (row as any).data ? (row as any).data[groupByField] : (row.values ? row.values[parseInt(groupByField.replace('field_', ''))] : undefined);
      let key = '（空白）';
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        if (typeof rawVal === 'boolean') key = rawVal ? '是 (Yes)' : '否 (No)';
        else if (Array.isArray(rawVal)) key = rawVal.map((item: any) => typeof item === 'object' ? item.value || item.name || String(item) : String(item)).join(', ') || '（空白）';
        else if (typeof rawVal === 'object') key = (rawVal as any).value || (rawVal as any).name || String(rawVal) || '（空白）';
        else key = String(rawVal);
      }
      if (!map.has(key)) map.set(key, { rows: [], originalIndices: [] });
      const grp = map.get(key)!;
      grp.rows.push(row);
      grp.originalIndices.push(idx);
    });
    return Array.from(map.entries());
  }, [rows, groupByField]);

  // Ensure Row 1 (index 0) is visible at top on initial mount
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, []);

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

  const handleMouseEnterRowHeader = useCallback((rIndex: number) => {
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

  // Virtualizer for high-performance rendering of 10,000+ rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 33,
    overscan: 10,
  });

  // Auto scroll to selected cell row when selectedCell changes
  useEffect(() => {
    if (selectedCell && rowVirtualizer) {
      rowVirtualizer.scrollToIndex(selectedCell[0], { align: 'auto' });
    }
  }, [selectedCell, rowVirtualizer]);

  // Reset scroll position to top when sort/filter/fields change
  useEffect(() => {
    if (bodyRef.current && !selectedCell) {
      bodyRef.current.scrollTop = 0;
    }
  }, [sortField, sortOrder, groupByField]);

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

  // Column aggregation mode selection state
  const [aggregationModes, setAggregationModes] = useState<Record<number, string>>({});
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

  // Advanced Aggregation summaries for field columns
  const fieldSummaries = useMemo(() => {
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

    fields.forEach((field) => {
      let count = 0;
      let emptyCount = 0;
      let sum = 0;
      let numericCount = 0;
      let minVal: any = null;
      let maxVal: any = null;
      const uniqueVals = new Set<string>();

      rows.forEach((row) => {
        const val = row.values[field.id];
        if (val !== undefined && val !== null && val !== '') {
          count++;
          const strVal = String(val);
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

      const total = rows.length;
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
  }, [fields, rows]);

  const totalTableWidth = useMemo(() => {
    return fields.reduce((sum, f) => sum + (f.width || 180), rowDetailsWidth) + 40;
  }, [fields, rowDetailsWidth]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="grid-view"
      style={{ outline: 'none', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* 1. Header Container (Synchronized Horizontal Scroll) */}
      <div
        ref={headerScrollRef}
        className="grid-view__head-container"
        onWheel={(e) => {
          if (bodyRef.current && (e.deltaX !== 0 || e.shiftKey)) {
            const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
            bodyRef.current.scrollLeft += delta;
          }
        }}
        style={{
          width: '100%',
          overflowX: 'hidden',
          overflowY: 'hidden',
          flexShrink: 0,
          background: '#ffffff',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          zIndex: 30
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
          onResizeColumn={handleResizeColumnLocal}
          onResizeColumnEnd={onResizeColumnEnd}
          onFieldClick={onFieldClick}
          onOpenFieldContextMenu={onOpenFieldContextMenu}
          onReorderFields={onReorderFields}
        />
      </div>

      {/* 2. Scrollable Rows Body Container */}
      <div 
        ref={bodyRef}
        className="grid-view__scroll-container" 
        onScroll={(e) => {
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }
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
        style={{ flex: 1, overflow: 'auto', width: '100%', minHeight: 0, position: 'relative', background: '#f4f5f8' }}
      >
        <div style={{ minWidth: '100%', width: 'max-content', display: 'flex', flexDirection: 'column' }}>
          {/* Rows Body */}
          <div className="grid-view__body-inner" style={{ width: 'max-content', minWidth: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            {groupedSections ? (
              <div className="grid-view__grouped-body" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {groupedSections.map(([groupKey, groupData]) => {
                  const isCollapsed = collapsedGroups[groupKey];
                  return (
                    <div key={groupKey} className="grid-view__group-section" style={{ width: '100%', marginBottom: '8px' }}>
                      {/* Group By Banner */}
                      <div
                        className="grid-view__group-by-banner"
                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          height: '34px',
                          backgroundColor: '#f8fafc',
                          borderTop: '1px solid #e2e8f0',
                          borderBottom: '1px solid #e2e8f0',
                          paddingLeft: '12px',
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#334155',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        {isCollapsed ? <ChevronRight size={16} style={{ marginRight: '6px' }} /> : <ChevronDown size={16} style={{ marginRight: '6px' }} />}
                        <span>{groupKey}</span>
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                          ({groupData.rows.length} 筆資料)
                        </span>
                      </div>

                      {/* Grouped Rows */}
                      {!isCollapsed && (
                        <div className="grid-view__grouped-rows" style={{ display: 'flex', flexDirection: 'column' }}>
                          {groupData.rows.map((row: RowData, inGrpIdx: number) => {
                            const rIndex = groupData.originalIndices[inGrpIdx];
                            return (
                              <GridViewRow
                                key={row.id}
                                row={row}
                                rowIndex={rIndex >= 0 ? rIndex : 0}
                                fields={fields}
                                rowColorRules={rowColorRules}
                                rowDetailsWidth={rowDetailsWidth}
                                selectedColumnIndex={selectedCell?.[0] === rIndex ? selectedCell[1] : null}
                                isCellEditing={selectedCell?.[0] === rIndex && isEditing}
                                selectionBounds={selectionBounds}
                                isRowSelectedDirectly={selectedRowIds.has(row.id)}
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
                                  setIsEditing(true);
                                }}
                                onUpdateCell={(fieldId, val) => {
                                  onUpdateCell?.(row.id, fieldId, val);
                                }}
                                onUpdateField={onUpdateField}
                                onCancelEditCell={() => setIsEditing(false)}
                                onExpandRow={() => onExpandRow?.(row.id)}
                                onReorderRows={onReorderRows}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="grid-view__rows"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: `${totalTableWidth}px`,
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
                        width: `${totalTableWidth}px`,
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
                        selectedColumnIndex={selectedCell?.[0] === rIndex ? selectedCell[1] : null}
                        isCellEditing={selectedCell?.[0] === rIndex && isEditing}
                        selectionBounds={selectionBounds}
                        isRowSelectedDirectly={selectedRowIds.has(row.id)}
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
                          setIsEditing(true);
                        }}
                        onUpdateCell={(fieldId, val) => {
                          onUpdateCell?.(row.id, fieldId, val);
                        }}
                        onUpdateField={onUpdateField}
                        onCancelEditCell={() => setIsEditing(false)}
                        onExpandRow={() => onExpandRow?.(row.id)}
                        onReorderRows={onReorderRows}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Baserow Add Row Bar (Full width table row entry matching row length) */}
            <div
              className="grid-view__add-row-bar"
              onClick={onAddRow}
              style={{
                display: 'flex',
                width: `${totalTableWidth}px`,
                height: 'var(--row-height, 33px)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
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
                  color: '#2563eb',
                  boxSizing: 'border-box',
                }}
              >
                <Plus style={{ width: '14px', height: '14px' }} />
              </div>

              {/* Add row text spanning remaining width matching row length */}
              <div
                style={{
                  width: `${totalTableWidth - rowDetailsWidth}px`,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '12px',
                  fontSize: '13px',
                  color: '#2563eb',
                  fontWeight: 500,
                  borderRight: '1px solid var(--border-color, #e2e8f0)',
                  boxSizing: 'border-box',
                }}
              >
                新增資料列
              </div>
            </div>

            {/* Scroll padding area below table */}
            <div style={{ height: '80px', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* 2. Fixed Bottom Summary Footer Bar */}
      <div
        ref={footerScrollRef}
        className="grid-view__footer-container"
        onWheel={(e) => {
          if (bodyRef.current && (e.deltaX !== 0 || e.shiftKey)) {
            const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
            bodyRef.current.scrollLeft += delta;
          }
        }}
        style={{
          flexShrink: 0,
          width: '100%',
          overflowX: 'hidden',
          borderTop: '1.5px solid #cbd5e1',
          background: '#f8fafc',
          zIndex: 35,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="grid-view__summary-bar"
          style={{
            display: 'flex',
            width: `${totalTableWidth}px`,
            boxSizing: 'border-box',
            fontSize: '12px',
            color: '#475569',
          }}
        >
          <div style={{
            width: `${rowDetailsWidth}px`,
            position: 'sticky',
            left: 0,
            zIndex: 25,
            flexShrink: 0,
            padding: '6px 8px',
            textAlign: 'center',
            fontWeight: 600,
            borderRight: '1px solid #e2e8f0',
            background: '#f1f5f9',
            color: '#334155'
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
                  setAggregationModes(prev => ({ ...prev, [fieldId]: newMode }))
                }}
              />
            );
          })}
          {/* Footer Add Field Spacer */}
          <div
            style={{
              width: '40px',
              minWidth: '40px',
              flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              boxSizing: 'border-box',
              background: '#f8fafc'
            }}
          />
        </div>
      </div>

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
                  setAggregationModes(prev => ({ ...prev, [targetField.id]: item.key }));
                  setAggMenuState(null);
                }}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  background: currentMode === item.key ? '#f1f5f9' : 'transparent',
                  fontWeight: currentMode === item.key ? 600 : 400,
                  color: currentMode === item.key ? '#2563eb' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{item.label}</span>
                {currentMode === item.key && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>}
              </div>
            ))}
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
