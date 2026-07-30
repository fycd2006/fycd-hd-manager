import { Parser } from 'hot-formula-parser'
import * as formulajs from '@formulajs/formulajs'

// ─── Variable reference regex (matches field_123, F1, F2, F100, {field_1}) ───
const FIELD_REF_REGEX = /\{?\b(field_\d+|F\d+)\b\}?/gi

/**
 * Convert 0-based column index to F-alias (0 -> F1, 1 -> F2, etc.)
 */
export function getColumnAlias(index: number): string {
  return `F${index + 1}`
}

/**
 * Extract all variable names from a formula expression string.
 */
export function extractVariables(expression: string): string[] {
  let exprStr = expression
  if (exprStr && exprStr.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(exprStr)
      if (parsed && typeof parsed === 'object' && parsed.formula) {
        exprStr = String(parsed.formula)
      }
    } catch {}
  }
  const matches = exprStr.match(FIELD_REF_REGEX)
  return matches ? [...new Set(matches.map(m => m.replace(/[\{\}\[\]]/g, '').toLowerCase()))] : []
}

/**
 * Validate formula syntax. Throws on invalid syntax.
 * Replaces field references with 0 for parsing since the parser
 * would otherwise trigger callVariable events.
 */
export function parseFormula(expression: string): void {
  if (!expression || !expression.trim()) return
  let exprStr = expression.trim()
  if (exprStr.startsWith('{')) {
    try {
      const parsed = JSON.parse(exprStr)
      if (parsed && typeof parsed === 'object' && parsed.formula) {
        exprStr = String(parsed.formula).trim()
      }
    } catch {}
  }

  const parser = new Parser()
  // Substitute field refs & F1/F2 aliases with a valid literal so parser can check syntax
  const sanitized = exprStr.replace(FIELD_REF_REGEX, '0')
  const { error } = parser.parse(sanitized)
  if (error) throw new Error(error)
}

/**
 * Preprocess short F-aliases (e.g., F1, F2, F3 or F101) into exact field_ID keys.
 * Preserves the exact visual column order defined by fieldOrder (array of field IDs).
 */
export function preprocessShortAliases(
  expression: string,
  variables: Record<string, string | number | boolean | null>,
  fieldOrder?: number[]
): string {
  if (!expression) return expression

  let orderedKeys: string[] = []
  if (fieldOrder && Array.isArray(fieldOrder) && fieldOrder.length > 0) {
    orderedKeys = fieldOrder.map(id => `field_${id}`).filter(k => k in (variables || {}))
    Object.keys(variables || {}).forEach(k => {
      if (!orderedKeys.includes(k)) orderedKeys.push(k)
    })
  } else {
    orderedKeys = Object.keys(variables || {})
  }

  return expression.replace(/\{?\bF(\d+)\b\}?/gi, (match, p1) => {
    const num = parseInt(p1, 10)
    
    // 1. Direct Field ID match FIRST (e.g. F12 -> field_12)
    const directIdKey = orderedKeys.find(k => {
      const lower = k.toLowerCase()
      return lower === `field_${num}` || lower === `${num}`
    })
    if (directIdKey) return directIdKey

    // 2. 1-based Visual Column Index match SECOND (e.g. F1 -> 1st column, F2 -> 2nd column)
    if (num >= 1 && num <= orderedKeys.length) {
      return orderedKeys[num - 1]
    }

    return match
  })
}

/**
 * Helper to clean and parse cell values into numeric or string representation.
 */
function resolveCellValue(rawVal: any): any {
  if (rawVal === null || rawVal === undefined) return 0
  if (typeof rawVal === 'number') return isNaN(rawVal) ? 0 : rawVal
  if (typeof rawVal === 'boolean') return rawVal ? 1 : 0
  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim()
    if (!trimmed) return 0

    // Strip thousand separators ',' and currency symbols/spaces if it's a numeric string
    const cleanNumStr = trimmed.replace(/,/g, '').replace(/^[^\d\-+.]+/, '').trim()
    if (cleanNumStr && cleanNumStr !== '-' && !isNaN(Number(cleanNumStr))) {
      return Number(cleanNumStr)
    }
    return trimmed
  }
  return rawVal
}

/**
 * Create a configured Parser instance with variable resolution and formulajs fallback.
 */
function createParser(variables: Record<string, string | number | boolean | null>): Parser {
  const parser = new Parser()

  // Normalize variables map for case-insensitive lookup & clean ID lookup
  const normalizedVars: Record<string, any> = {}
  if (variables && typeof variables === 'object') {
    Object.entries(variables).forEach(([k, v]) => {
      const lowerKey = k.toLowerCase().replace(/[\{\}\[\]]/g, '').trim()
      normalizedVars[lowerKey] = v
      if (lowerKey.startsWith('field_')) {
        normalizedVars[lowerKey.replace('field_', '')] = v
      }
    })
  }

  // Resolve field_* variables (hot-formula-parser passes variable names in UPPERCASE)
  parser.on('callVariable', (name: string, done: (val: any) => void) => {
    const upperName = name.toUpperCase()
    if (upperName === 'TRUE') { done(true); return }
    if (upperName === 'FALSE') { done(false); return }
    if (upperName === 'NULL') { done(null); return }

    const cleanName = name.toLowerCase().replace(/[\{\}\[\]]/g, '').trim()
    const foundKey = cleanName in normalizedVars 
      ? cleanName 
      : (`field_${cleanName}` in normalizedVars ? `field_${cleanName}` : null)

    if (foundKey) {
      const rawVal = normalizedVars[foundKey]
      done(resolveCellValue(rawVal))
    } else {
      done(0)
    }
  })

  // Function dispatch: custom first, then formulajs, then let built-in handle
  parser.on('callFunction', (name: string, params: any[], done: (val: any) => void) => {
    const upper = name.toUpperCase()

    // ── Custom functions (not in Excel/formulajs) ──
    if (upper === 'CONTAINS') {
      const haystack = String(params[0] ?? '').toLowerCase()
      const needle = String(params[1] ?? '').toLowerCase()
      done(haystack.includes(needle))
      return
    }
    if (upper === 'ISBLANK') {
      done(params[0] == null || String(params[0]).trim() === '' || params[0] === 0)
      return
    }
    if (upper === 'IFERROR') {
      const val = params[0]
      const isErr = val === undefined || 
        val === null || 
        val === Infinity || 
        val === -Infinity || 
        Number.isNaN(val) ||
        (typeof val === 'string' && val.startsWith('#')) ||
        (typeof val === 'object' && val !== null && (val.type || val.error || val.value))
      if (isErr) {
        done(params[1] !== undefined ? params[1] : 0)
      } else {
        done(val)
      }
      return
    }
    if (upper === 'DATE_DIFF') {
      const d1 = new Date(String(params[0]))
      const d2 = new Date(String(params[1]))
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) { done(0); return }
      done(Math.floor((d2.getTime() - d1.getTime()) / 86400000))
      return
    }

    // ── formulajs fallback (399 Excel functions) ──
    const fn = (formulajs as Record<string, unknown>)[upper] ?? (formulajs as Record<string, unknown>)[name]
    if (typeof fn === 'function') {
      try {
        const result = fn(...params)
        // formulajs DATE/TODAY returns Date objects — convert to ISO string
        if (result instanceof Date) {
          done(result.toISOString().split('T')[0])
        } else {
          done(result)
        }
      } catch {
        done(undefined)
      }
      return
    }

    // Let parser built-in handle (SUM, IF, UPPER, LOWER, etc.)
    done(undefined)
  })

  return parser
}

/**
 * Evaluate a formula expression with given variables.
 * Returns the computed result or an error string like '#DIV/0!'.
 * Accepts an optional fieldOrder array of field IDs in column display order.
 */
export function evaluateFormula(
  expression: string,
  variables: Record<string, string | number | boolean | null>,
  fieldOrder?: number[]
): string | number | boolean | null {
  if (!expression || !expression.trim()) return null
  let trimExpr = expression.trim()

  // Auto-parse JSON string if options object was passed
  if (trimExpr.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimExpr)
      if (parsed && typeof parsed === 'object' && parsed.formula) {
        trimExpr = String(parsed.formula).trim()
      }
    } catch {}
  }

  // Handle top-level IFERROR(expr, fallback) wrapper
  const ifErrorMatch = trimExpr.match(/^IFERROR\s*\(\s*(.+)\s*,\s*(.+)\s*\)$/i)
  if (ifErrorMatch) {
    const innerExpr = ifErrorMatch[1].trim()
    const fallbackExpr = ifErrorMatch[2].trim()
    const innerRes = evaluateFormula(innerExpr, variables, fieldOrder)
    if (innerRes === null || innerRes === undefined || (typeof innerRes === 'string' && innerRes.startsWith('#'))) {
      const fallbackRes = evaluateFormula(fallbackExpr, variables, fieldOrder)
      return fallbackRes
    }
    return innerRes
  }

  // Preprocess F1, F2, F3 short field aliases into field_ID keys preserving visual column order
  const preprocessed = preprocessShortAliases(trimExpr, variables, fieldOrder)

  // Pre-process expression: replace {field_1}, [field_1], [F1]
  const sanitizedExpr = preprocessed
    .replace(/[\{\}]/g, '')
    .replace(/\[field_(\d+)\]/gi, 'field_$1')
    .replace(/\[F(\d+)\]/gi, 'F$1')

  const parser = createParser(variables)
  const { result, error } = parser.parse(sanitizedExpr)
  if (error) return error.startsWith('#') ? error : `#${error}`
  return result
}

/**
 * Detect circular dependency in formula map.
 */
export function detectCircularDependency(
  targetKey: string,
  formulaMap: Record<string, string>,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(targetKey)) return true
  visited.add(targetKey)

  const expr = formulaMap[targetKey]
  if (!expr) return false

  const referencedVars = extractVariables(expr)
  for (const ref of referencedVars) {
    if (ref in formulaMap) {
      if (detectCircularDependency(ref, formulaMap, new Set(visited))) {
        return true
      }
    }
  }

  return false
}

export interface FormulaFunctionDoc {
  name: string
  category: string
  doc: string
  snippet: string
}

export function getSupportedFunctions(): { category: string; funcs: FormulaFunctionDoc[] }[] {
  return [
    {
      category: '數學與統計 (Math & Stat)',
      funcs: [
        { name: 'SUM', category: 'Math', doc: '計算參數總和。範例: SUM(F1, F2, 100)', snippet: 'SUM(' },
        { name: 'AVERAGE', category: 'Math', doc: '計算平均值。範例: AVERAGE(F1, F2)', snippet: 'AVERAGE(' },
        { name: 'COUNT', category: 'Math', doc: '計算數字個數。範例: COUNT(F1, F2)', snippet: 'COUNT(' },
        { name: 'MAX', category: 'Math', doc: '取得最大值。範例: MAX(F1, 100)', snippet: 'MAX(' },
        { name: 'MIN', category: 'Math', doc: '取得最小值。範例: MIN(F1, 0)', snippet: 'MIN(' },
        { name: 'ROUND', category: 'Math', doc: '四捨五入至指定位數。範例: ROUND(F1, 2)', snippet: 'ROUND(' },
        { name: 'ABS', category: 'Math', doc: '計算絕對值。範例: ABS(F1)', snippet: 'ABS(' },
      ]
    },
    {
      category: '邏輯與判斷 (Logical)',
      funcs: [
        { name: 'IF', category: 'Logical', doc: '邏輯判斷。範例: IF(F1 > 100, F2 * 0.9, F2)', snippet: 'IF(' },
        { name: 'AND', category: 'Logical', doc: '所有條件皆為真時回傳 TRUE。範例: AND(F1 > 0, F2 > 0)', snippet: 'AND(' },
        { name: 'OR', category: 'Logical', doc: '任一條件為真時回傳 TRUE。範例: OR(F1 = 1, F2 = 1)', snippet: 'OR(' },
        { name: 'NOT', category: 'Logical', doc: '反轉布林值。範例: NOT(F1)', snippet: 'NOT(' },
        { name: 'IFERROR', category: 'Logical', doc: '當計算發生錯誤時回傳預設值。範例: IFERROR(F1 / F2, 0)', snippet: 'IFERROR(' },
        { name: 'ISBLANK', category: 'Logical', doc: '檢查單元格是否為空。範例: ISBLANK(F1)', snippet: 'ISBLANK(' },
      ]
    },
    {
      category: '文字處理 (Text)',
      funcs: [
        { name: 'CONCAT', category: 'Text', doc: '連接多個字串。範例: CONCAT(F1, " ", F2)', snippet: 'CONCAT(' },
        { name: 'LEFT', category: 'Text', doc: '截取左側字串。範例: LEFT(F1, 3)', snippet: 'LEFT(' },
        { name: 'RIGHT', category: 'Text', doc: '截取右側字串。範例: RIGHT(F1, 3)', snippet: 'RIGHT(' },
        { name: 'MID', category: 'Text', doc: '截取中間字串。範例: MID(F1, 2, 5)', snippet: 'MID(' },
        { name: 'LEN', category: 'Text', doc: '計算字串長度。範例: LEN(F1)', snippet: 'LEN(' },
        { name: 'UPPER', category: 'Text', doc: '轉為大寫。範例: UPPER(F1)', snippet: 'UPPER(' },
        { name: 'LOWER', category: 'Text', doc: '轉為小寫。範例: LOWER(F1)', snippet: 'LOWER(' },
        { name: 'CONTAINS', category: 'Text', doc: '檢查是否包含關鍵字。範例: CONTAINS(F1, "VIP")', snippet: 'CONTAINS(' },
      ]
    },
    {
      category: '日期與時間 (Date & Time)',
      funcs: [
        { name: 'DATE', category: 'Date', doc: '建立日期物件。範例: DATE(2026, 7, 30)', snippet: 'DATE(' },
        { name: 'TODAY', category: 'Date', doc: '取得今日日期。範例: TODAY()', snippet: 'TODAY()' },
        { name: 'NOW', category: 'Date', doc: '取得當前時間。範例: NOW()', snippet: 'NOW()' },
        { name: 'YEAR', category: 'Date', doc: '取得年份。範例: YEAR(F1)', snippet: 'YEAR(' },
        { name: 'MONTH', category: 'Date', doc: '取得月份。範例: MONTH(F1)', snippet: 'MONTH(' },
        { name: 'DAY', category: 'Date', doc: '取得日期。範例: DAY(F1)', snippet: 'DAY(' },
        { name: 'DATE_DIFF', category: 'Date', doc: '計算兩日期差距天數。範例: DATE_DIFF(F1, F2)', snippet: 'DATE_DIFF(' },
      ]
    }
  ]
}
