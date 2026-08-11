import { useReducer, useCallback, useMemo } from 'react'
import { TableRow, TableField, CellValue } from '@/modules/database/types'
import { evaluateFormula } from '@/lib/formula'

export type OperationType = 'create' | 'delete' | 'update' | 'reorder' | 'move'
export type OperationStatus = 'staged' | 'pending' | 'confirmed' | 'failed'

export interface PendingOperation {
  id: string // UUID 
  type: OperationType
  status: OperationStatus
  createdAt: number
  
  tableId?: number // The table where this operation originated
  rowIds?: number[] // For delete, move
  clientId?: string // For create
  sourceRowIds?: number[] // For move
  rowsData?: any[] // For create
  fieldKey?: string // For update
  value?: CellValue // For update
  sourceTableId?: number // For move
  targetTableId?: number // For move

  // Undo/Redo payload
  undoPayload?: any 
}

export interface TableOperationsState {
  baseRows: TableRow[]
  operations: PendingOperation[]
  lastUndoableOperations: PendingOperation[]
}

type Action = 
  | { type: 'SET_BASE_ROWS'; payload: TableRow[] | ((prev: TableRow[]) => TableRow[]) }
  | { type: 'ADD_OPERATION'; payload: PendingOperation }
  | { type: 'UPDATE_OPERATION_STATUS'; payload: { id: string, status: OperationStatus } }
  | { type: 'REMOVE_OPERATION'; payload: string }
  | { type: 'APPLY_UPDATE_OPTIMISTIC'; payload: { rowId: number, fieldKey: string, value: CellValue, fields: TableField[] } }
  | { type: 'APPLY_CREATE_OPTIMISTIC'; payload: { rows: TableRow[] } }
  | { type: 'APPLY_DELETE_OPTIMISTIC'; payload: { rowIds: number[] } }
  | { type: 'REVERT_DELETE_OPTIMISTIC'; payload: { rowIds: number[] } }
  | { type: 'REVERT_UPDATE_OPTIMISTIC'; payload: { rowId: number, fieldKey: string, previousValue: CellValue, fields: TableField[] } }
  | { type: 'SET_UNDOABLE'; payload: PendingOperation }
  | { type: 'POP_UNDOABLE' }

function tableReducer(state: TableOperationsState, action: Action): TableOperationsState {
  switch (action.type) {
    case 'SET_BASE_ROWS':
      const newBaseRows = typeof action.payload === 'function' ? action.payload(state.baseRows) : action.payload
      return { ...state, baseRows: newBaseRows }
    
    case 'ADD_OPERATION':
      return { ...state, operations: [...state.operations, action.payload] }

    case 'UPDATE_OPERATION_STATUS':
      return {
        ...state,
        operations: state.operations.map(op => 
          op.id === action.payload.id ? { ...op, status: action.payload.status } : op
        )
      }

    case 'REMOVE_OPERATION':
      return {
        ...state,
        operations: state.operations.filter(op => op.id !== action.payload)
      }

    case 'APPLY_UPDATE_OPTIMISTIC': {
      const { rowId, fieldKey, value, fields } = action.payload
      const formulaFields = fields.filter(f => f.type === 'formula')
      
      const newBaseRows = state.baseRows.map(r => {
        if (r.id !== rowId && r.clientId !== String(rowId)) return r
        const updatedData = { ...r.data, [fieldKey]: value }
        
        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          let expr = ff.options
          if (!expr) return
          if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
            try {
              let parsed = JSON.parse(expr)
              if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed) } catch { } }
              if (parsed && typeof parsed === 'object' && parsed.formula) expr = parsed.formula
            } catch { }
          }
          try {
            const fieldOrder = fields.map(f => f.id)
            const res = evaluateFormula(expr, updatedData as any, fieldOrder)
            updatedData[destKey] = res != null ? String(res) : ''
          } catch {
            updatedData[destKey] = '#VALUE!'
          }
        })
        
        return { ...r, data: updatedData }
      })
      return { ...state, baseRows: newBaseRows }
    }

    case 'REVERT_UPDATE_OPTIMISTIC': {
      const { rowId, fieldKey, previousValue, fields } = action.payload
      // Similar logic as above but reverting
      const formulaFields = fields.filter(f => f.type === 'formula')
      const newBaseRows = state.baseRows.map(r => {
        if (r.id !== rowId) return r
        const updatedData = { ...r.data, [fieldKey]: previousValue }
        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          // simplified...
        })
        return { ...r, data: updatedData }
      })
      return { ...state, baseRows: newBaseRows }
    }

    case 'APPLY_CREATE_OPTIMISTIC':
      // Ensure no duplicates
      const newRows = action.payload.rows.filter(nr => !state.baseRows.some(br => br.clientId === nr.clientId || br.id === nr.id))
      return { ...state, baseRows: [...state.baseRows, ...newRows] }

    case 'APPLY_DELETE_OPTIMISTIC':
      return {
        ...state,
        baseRows: state.baseRows.filter(r => !action.payload.rowIds.includes(r.id))
      }
      
    case 'SET_UNDOABLE':
      // Push to undo stack (limit to 10 for simplicity)
      return {
        ...state,
        lastUndoableOperations: [...state.lastUndoableOperations, action.payload].slice(-10)
      }

    case 'POP_UNDOABLE':
      return {
        ...state,
        lastUndoableOperations: state.lastUndoableOperations.slice(0, -1)
      }

    default:
      return state
  }
}

export function useTableOperations(activeTableId: number | null) {
  const [state, dispatch] = useReducer(tableReducer, {
    baseRows: [],
    operations: [],
    lastUndoableOperations: []
  })

  const derivedRows = useMemo(() => {
    // We already do optimistic updates in baseRows, but for 'move' status='staged',
    // we want to mark them so UI can render them with opacity.
    const stagedMoveOps = state.operations.filter(op => 
      op.type === 'move' && 
      op.status === 'staged' && 
      op.tableId === activeTableId
    )
    const stagedRowIds = new Set<number>()
    stagedMoveOps.forEach(op => {
      if (op.rowIds) op.rowIds.forEach(id => stagedRowIds.add(id))
    })

    if (stagedRowIds.size === 0) return state.baseRows

    return state.baseRows.map(r => {
      if (stagedRowIds.has(r.id)) {
        return { ...r, _isStagedForMove: true } as TableRow & { _isStagedForMove: boolean }
      }
      return r
    })
  }, [state.baseRows, state.operations])

  return {
    rows: derivedRows,
    operations: state.operations,
    undoableOperations: state.lastUndoableOperations,
    dispatch
  }
}
