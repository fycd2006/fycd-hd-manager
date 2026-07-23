'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { TableField } from '@/modules/database/types';
import { GridViewHead } from './GridViewHead';
import { GridViewRow } from './GridViewRow';
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
}

export const GridView: React.FC<GridViewProps> = ({
  fields,
  rows,
  sortField,
  sortOrder,
  groupByField,
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
}) => {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

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
    if (!selectionBounds) return;
    const lines: string[] = [];
    for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
      const row = rows[r];
      if (!row) continue;
      const rowCells: string[] = [];
      for (let c = selectionBounds.minCol; c <= selectionBounds.maxCol; c++) {
        const field = fields[c];
        if (!field) continue;
        const val = row.values?.[field.id] ?? (row as any).data?.[`field_${field.id}`] ?? (row as any).data?.[field.id] ?? '';
        let cellStr = '';
        if (val !== null && val !== undefined) {
          if (Array.isArray(val)) {
            cellStr = val.map(item => typeof item === 'object' ? item.value || item.name || String(item) : String(item)).join(', ');
          } else if (typeof val === 'object') {
            cellStr = (val as any).value || (val as any).name || String(val);
          } else {
            cellStr = String(val);
          }
        }
        rowCells.push(cellStr.replace(/\t/g, ' ').replace(/\n/g, ' '));
      }
      lines.push(rowCells.join('\t'));
    }
    const tsv = lines.join('\n');
    if (tsv && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tsv);
      const count = (selectionBounds.maxRow - selectionBounds.minRow + 1) * (selectionBounds.maxCol - selectionBounds.minCol + 1);
      showToast(`已複製 ${count} 個儲存格至剪貼簿`);
    }
  }, [selectionBounds, rows, fields, showToast]);

  const handleClearSelectionValues = useCallback(() => {
    if (!selectionBounds) return;
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
  }, [selectionBounds, rows, fields, onUpdateCell, showToast]);

  const handleDeleteSelectedRows = useCallback(() => {
    if (!selectionBounds) return;
    const rowIdsToDelete = new Set<number>();
    for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
      const targetRow = rows[r];
      if (targetRow) {
        rowIdsToDelete.add(targetRow.id);
      }
    }
    const count = rowIdsToDelete.size;
    rowIdsToDelete.forEach(id => onDeleteRow?.(id));
    setSelectedCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    showToast(`已刪除 ${count} 列資料`);
  }, [selectionBounds, rows, onDeleteRow, showToast]);

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

  // Virtualizer for high-performance rendering of 10,000+ rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 33,
    overscan: 10,
  });

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

  // Aggregation summaries for field columns
  const fieldSummaries = useMemo(() => {
    const result: Record<number, { count: number; sum: number | null; avg: number | null }> = {};

    fields.forEach((field) => {
      let count = 0;
      let sum = 0;
      let isNumeric = field.type === 'number' || field.type === 'rating';

      rows.forEach((row) => {
        const val = row.values[field.id];
        if (val !== undefined && val !== null && val !== '') {
          count++;
          if (isNumeric && !isNaN(Number(val))) {
            sum += Number(val);
          }
        }
      });

      result[field.id] = {
        count,
        sum: isNumeric && count > 0 ? sum : null,
        avg: isNumeric && count > 0 ? Number((sum / count).toFixed(2)) : null,
      };
    });

    return result;
  }, [fields, rows]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="grid-view"
      style={{ outline: 'none', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div 
        className="grid-view__scroll-container" 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'auto', overflowY: 'hidden', width: '100%' }}
      >
        <div style={{ minWidth: '100%', width: 'max-content', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* 1. Header Row */}
          <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#ffffff', flexShrink: 0, borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
            <GridViewHead
              fields={fields}
              rowDetailsWidth={rowDetailsWidth}
              sortField={sortField}
              sortOrder={sortOrder}
              onAddField={onAddField}
              onResizeColumn={handleResizeColumnLocal}
              onResizeColumnEnd={onResizeColumnEnd}
              onFieldClick={onFieldClick}
              onOpenFieldContextMenu={onOpenFieldContextMenu}
            />
          </div>

          {/* 2. Rows Body with Virtual Scrolling */}
          <div
            ref={bodyRef}
            className="grid-view__body"
            onContextMenu={(e) => {
              if (selectionBounds) {
                e.preventDefault();
                setCellContextMenu({ x: e.clientX, y: e.clientY });
              }
            }}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
          >
          <div className="grid-view__body-inner" style={{ width: 'max-content', minWidth: '100%', display: 'flex', flexDirection: 'column' }}>
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
                          padding: '0 12px',
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#334155',
                          cursor: 'pointer',
                          userSelect: 'none',
                          position: 'sticky',
                          top: 0,
                          zIndex: 20,
                          gap: '8px'
                        }}
                      >
                        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </span>
                        <span style={{ color: '#64748b', fontWeight: 500 }}>{groupedField?.name || '欄位'}:</span>
                        <span style={{
                          backgroundColor: groupKey === '（空白）' ? '#f1f5f9' : '#e0f2fe',
                          color: groupKey === '（空白）' ? '#64748b' : '#0369a1',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          {groupKey}
                        </span>
                        <span style={{
                          backgroundColor: '#e2e8f0',
                          color: '#475569',
                          borderRadius: '10px',
                          padding: '1px 7px',
                          fontSize: '11px',
                          fontWeight: 600,
                          marginLeft: '4px'
                        }}>
                          {groupData.rows.length} 筆
                        </span>
                      </div>

                      {/* Group Rows */}
                      {!isCollapsed && groupData.rows.map((row, inGrpIdx) => {
                        const rIndex = groupData.originalIndices[inGrpIdx];
                        return (
                          <GridViewRow
                            key={row.id}
                            row={row}
                            rowIndex={rIndex}
                            fields={fields}
                            rowDetailsWidth={rowDetailsWidth}
                            selectedColumnIndex={selectedCell?.[0] === rIndex ? selectedCell[1] : null}
                            isCellEditing={selectedCell?.[0] === rIndex && isEditing}
                            selectionBounds={selectionBounds}
                            onSelectCell={(cIndex, e) => {
                              if (e?.shiftKey && selectionStart) {
                                setSelectionEnd([rIndex, cIndex]);
                              } else {
                                setSelectionStart([rIndex, cIndex]);
                                setSelectionEnd([rIndex, cIndex]);
                                setIsDraggingSelection(true);
                                setSelectedCell([rIndex, cIndex]);
                                setIsEditing(false);
                              }
                            }}
                            onMouseEnterCell={(cIndex) => {
                              if (isDraggingSelection) {
                                setSelectionEnd([rIndex, cIndex]);
                              } else if (isAutofilling) {
                                setAutofillEnd([rIndex, cIndex]);
                                setSelectionEnd([rIndex, cIndex]);
                              }
                            }}
                            onStartAutofillCell={(cIndex) => {
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
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="grid-view__rows"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
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
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        zIndex: selectedCell?.[0] === rIndex && isEditing ? 100 : (selectedCell?.[0] === rIndex ? 10 : 1),
                      }}
                    >
                      <GridViewRow
                        row={row}
                        rowIndex={rIndex}
                        fields={fields}
                        rowDetailsWidth={rowDetailsWidth}
                        selectedColumnIndex={selectedCell?.[0] === rIndex ? selectedCell[1] : null}
                        isCellEditing={selectedCell?.[0] === rIndex && isEditing}
                        selectionBounds={selectionBounds}
                        onSelectCell={(cIndex, e) => {
                          if (e?.shiftKey && selectionStart) {
                            setSelectionEnd([rIndex, cIndex]);
                          } else {
                            setSelectionStart([rIndex, cIndex]);
                            setSelectionEnd([rIndex, cIndex]);
                            setIsDraggingSelection(true);
                            setSelectedCell([rIndex, cIndex]);
                            setIsEditing(false);
                          }
                        }}
                        onMouseEnterCell={(cIndex) => {
                          if (isDraggingSelection) {
                            setSelectionEnd([rIndex, cIndex]);
                          } else if (isAutofilling) {
                            setAutofillEnd([rIndex, cIndex]);
                            setSelectionEnd([rIndex, cIndex]);
                          }
                        }}
                        onStartAutofillCell={(cIndex) => {
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
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Add Row & Aggregation Summary Footer */}
            <div className="grid-view__summary-bar" style={{ display: 'flex', width: 'max-content', minWidth: '100%', borderTop: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #f8fafc)', fontSize: '12px', color: '#64748b' }}>
              <div style={{ width: `${rowDetailsWidth}px`, flexShrink: 0, padding: '6px 8px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                {rows.length} 筆
              </div>
              {fields.map((field) => {
                const summary = fieldSummaries[field.id];
                return (
                  <div
                    key={field.id}
                    className="grid-view__summary-cell"
                    style={{
                      width: `var(--field-width-${field.id}, ${field.width || 180}px)`,
                      flexShrink: 0,
                      padding: '6px 8px',
                      borderRight: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {summary?.sum !== null ? (
                      <span>Σ {summary.sum} (均 {summary.avg})</span>
                    ) : (
                      <span>{summary?.count || 0} 筆填寫</span>
                    )}
                  </div>
                );
              })}
              <div style={{ flex: 1, padding: '12px 8px 180px 8px', minHeight: '200px' }}>
                <a
                  className="grid-view__add-row"
                  onClick={onAddRow}
                  style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 500 }}
                >
                  <i className="grid-view__add-row-icon iconoir-plus" style={{ marginRight: '4px' }}></i>
                  新增資料列
                </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

      {cellContextMenu && selectionBounds && (
        <MultiCellContextMenu
          x={cellContextMenu.x}
          y={cellContextMenu.y}
          selectedCellCount={(selectionBounds.maxRow - selectionBounds.minRow + 1) * (selectionBounds.maxCol - selectionBounds.minCol + 1)}
          selectedRowCount={selectionBounds.maxRow - selectionBounds.minRow + 1}
          onClose={() => setCellContextMenu(null)}
          onCopy={handleCopySelection}
          onCut={handleCutSelection}
          onPaste={handlePasteSelection}
          onClearValues={handleClearSelectionValues}
          onDeleteRows={handleDeleteSelectedRows}
        />
      )}

      {/* Floating UI/UX Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <span>✨ {toastMessage}</span>
        </div>
      )}
    </div>
  );
};
