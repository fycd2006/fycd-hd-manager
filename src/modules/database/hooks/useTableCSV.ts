import { useRef } from 'react'
import type { TableField, TableRow } from '../types'
import { exportToCSV, parseCSVFile, csvRowToTableRow } from '../utils/csv'
import * as fieldService from '../services/field'
import * as rowService from '../services/row'

export interface UseTableCSVOptions {
  activeTableId: number | null
  fields: TableField[]
  rows: TableRow[]
  hiddenFieldKeys: string[]
  workspaces: any[]
  setFields: React.Dispatch<React.SetStateAction<TableField[]>>
  setGridLoading: (loading: boolean) => void
  fetchTableData: (tableId: number) => Promise<void>
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function useTableCSV({
  activeTableId,
  fields,
  rows,
  hiddenFieldKeys,
  workspaces,
  setFields,
  setGridLoading,
  fetchTableData,
  addToast,
}: UseTableCSVOptions) {
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  // CSV Export
  const handleExportCSV = () => {
    try {
      const tableName =
        workspaces
          .flatMap((w: any) => w.databases || [])
          .flatMap((d: any) => d.tables || [])
          .find((t: any) => t.id === activeTableId)?.name || 'export'

      exportToCSV(fields, rows, hiddenFieldKeys, tableName)
      addToast('已導出 CSV 檔案', 'success')
    } catch (error) {
      addToast((error as Error).message || '導出失敗', 'error')
    }
  }

  // CSV Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeTableId) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result as string
      if (!text) return

      try {
        setGridLoading(true)
        const { headers, rows: csvRows } = parseCSVFile(text)

        // Create fields from headers if they don't exist
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i]
          if (!fields.find(f => f.name === header)) {
            await fieldService.createField(activeTableId, {
              name: header,
              type: 'text',
              options: null,
            })
          }
        }

        // Refresh fields after creating new ones
        const updatedFields = await fieldService.fetchFields(activeTableId)
        setFields(updatedFields)

        // Import rows
        for (const csvRow of csvRows) {
          const rowData = csvRowToTableRow(csvRow, updatedFields)
          await rowService.createRow(activeTableId, rowData)
        }

        await fetchTableData(activeTableId)
        addToast('CSV 匯入成功', 'success')
      } catch (error) {
        addToast((error as Error).message || 'CSV 匯入失敗', 'error')
      } finally {
        setGridLoading(false)
        if (csvInputRef.current) {
          csvInputRef.current.value = ''
        }
      }
    }
    reader.readAsText(file)
  }

  return {
    csvInputRef,
    handleExportCSV,
    handleCSVImport,
  }
}

export default useTableCSV
