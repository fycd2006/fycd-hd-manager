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

const MAX_CSV_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB
const BATCH_IMPORT_SIZE = 100

/**
 * Automatically infers field type based on non-empty sample cell values
 */
function inferFieldType(sampleValues: string[]): { type: string; options: any } {
  const nonEmpties = sampleValues.map(v => v.trim()).filter(Boolean)
  if (nonEmpties.length === 0) {
    return { type: 'text', options: null }
  }

  // 1. Check boolean ('true', 'false', '是', '否', '1', '0')
  const isBool = nonEmpties.every(v => {
    const l = v.toLowerCase()
    return l === 'true' || l === 'false' || l === '是' || l === '否' || l === '1' || l === '0'
  })
  if (isBool) {
    return { type: 'boolean', options: null }
  }

  // 2. Check number / currency
  const isNum = nonEmpties.every(v => {
    const clean = v.replace(/,/g, '').trim()
    return !isNaN(Number(clean)) && clean !== ''
  })
  if (isNum) {
    return { type: 'number', options: null }
  }

  // 3. Check date (YYYY-MM-DD or YYYY/MM/DD)
  const isDate = nonEmpties.every(v => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v) && !isNaN(Date.parse(v)))
  if (isDate) {
    return { type: 'date', options: null }
  }

  return { type: 'text', options: null }
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return await file.text()
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string) || '')
    reader.onerror = () => reject(new Error('讀取檔案失敗，請檢查檔案格式'))
    reader.readAsText(file)
  })
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

    // 1. Validate file size and type
    if (file.size > MAX_CSV_SIZE_BYTES) {
      addToast('CSV 檔案過大，請選擇小於 15MB 的檔案', 'error')
      if (csvInputRef.current) csvInputRef.current.value = ''
      return
    }

    try {
      setGridLoading(true)
      const text = await readFileText(file)

      const { headers, rows: csvRows } = parseCSVFile(text)
      if (headers.length === 0) {
        throw new Error('未在 CSV 檔案中找到有效表頭欄位')
      }

      // 2. Create fields from headers if they don't exist yet
      const existingFieldNames = new Set(fields.map(f => f.name.trim().toLowerCase()))

      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const header = headers[colIdx].trim()
        if (!header) continue

        if (!existingFieldNames.has(header.toLowerCase())) {
          // Collect sample values for type inference (first 50 rows)
          const sampleValues = csvRows.slice(0, 50).map(r => r[colIdx] || '')
          const inferred = inferFieldType(sampleValues)

          await fieldService.createField(activeTableId, {
            name: header,
            type: inferred.type,
            options: inferred.options,
          })
          existingFieldNames.add(header.toLowerCase())
        }
      }

      // 3. Refresh fields after creating new ones
      const updatedFields = await fieldService.fetchFields(activeTableId)
      setFields(updatedFields)

      // 4. Batch import rows in chunks of BATCH_IMPORT_SIZE
      let totalImported = 0
      for (let i = 0; i < csvRows.length; i += BATCH_IMPORT_SIZE) {
        const chunk = csvRows.slice(i, i + BATCH_IMPORT_SIZE)
        const rowsPayload = chunk.map((csvRow, idx) => ({
          clientId: `import-${Date.now()}-${i + idx}-${Math.random().toString(36).slice(2, 7)}`,
          data: csvRowToTableRow(csvRow, headers, updatedFields),
        }))

        const result = await rowService.batchCreateRows(activeTableId, rowsPayload)
        if (!result.ok) {
          throw new Error(result.error || `批次新增第 ${i + 1} 至 ${i + chunk.length} 列失敗`)
        }
        totalImported += chunk.length
      }

      await fetchTableData(activeTableId)
      addToast(`CSV 匯入成功，共匯入 ${totalImported} 筆資料`, 'success')
    } catch (error) {
      addToast((error as Error).message || 'CSV 匯入失敗', 'error')
    } finally {
      setGridLoading(false)
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  return {
    csvInputRef,
    handleExportCSV,
    handleCSVImport,
  }
}

export default useTableCSV
