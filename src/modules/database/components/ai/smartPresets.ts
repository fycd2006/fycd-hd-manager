import { extractChoices } from '@/modules/database/fields/types'
import type { TableField, TableRow, DynamicTable } from '@/modules/database/types'

export interface SmartPresetAction {
  prompt: string
  label: string
  category: 'stat' | 'fill' | 'check' | 'create' | 'selection' | 'general'
}

export const CATEGORY_BADGES: Record<string, { badge: string; color: string; bg: string }> = {
  selection: { badge: '🎯 鎖定選取', color: '#15803d', bg: '#f0fdf4' },
  stat: { badge: '📊 統計分析', color: '#2563eb', bg: '#eff6ff' },
  fill: { badge: '✏️ 批次填寫', color: '#7c3aed', bg: '#f5f3ff' },
  create: { badge: '➕ 快速新增', color: '#0d9488', bg: '#f0fdfa' },
  check: { badge: '🔍 完整度檢查', color: '#c2410c', bg: '#fff7ed' },
  general: { badge: '💡 常用指令', color: '#475569', bg: '#f8fafc' },
}

/**
 * Dynamically generates 3-5 intelligent suggested prompts based on the current
 * table's actual fields, field types, choice options, and user selection.
 */
export function generateSmartPresets({
  table,
  fields = [],
  rows = [],
  selectedRowIds = [],
}: {
  table?: DynamicTable | null
  fields?: TableField[]
  rows?: TableRow[]
  selectedRowIds?: number[]
}): SmartPresetAction[] {
  if (!fields || fields.length === 0) {
    return [
      { prompt: '統計這張表格目前的總人數與各組別分佈', label: '總人數與分佈統計', category: 'stat' },
      { prompt: '檢查這張資料表是否有格式不完整或空白遺漏的列', label: '格式完整度檢查', category: 'check' },
      { prompt: '新增一筆範例測試資料', label: '新增測試資料', category: 'create' },
    ]
  }

  const result: SmartPresetAction[] = []
  const hasSelection = selectedRowIds && selectedRowIds.length > 0

  const primaryField = fields[0]
  const selectFields = fields.filter(f => f.type === 'single_select' || f.type === 'multiple_select')
  const numberFields = fields.filter(f => f.type === 'number' || f.type === 'rating')
  const booleanFields = fields.filter(f => f.type === 'boolean')
  const commentFields = fields.filter(f => f.type === 'latest_comment')
  const dateFields = fields.filter(f => f.type === 'date')

  // 1. If user currently has rows selected, give high priority to selection actions!
  if (hasSelection) {
    if (selectFields.length > 0) {
      const sf = selectFields[0]
      const choices = extractChoices(sf.options)
      const choiceName = choices[0]?.name || choices[0]?.value || '已完成'
      result.push({
        prompt: `將選取的 ${selectedRowIds.length} 筆資料之「${sf.name}」設為「${choiceName}」`,
        label: `批次設定「${sf.name}」`,
        category: 'selection'
      })
    }
    if (commentFields.length > 0) {
      const cf = commentFields[0]
      result.push({
        prompt: `為選取的 ${selectedRowIds.length} 筆資料之「${cf.name}」新增備註紀錄：「今日已確認完成」`,
        label: `批次新增備註紀錄`,
        category: 'selection'
      })
    }
    result.push({
      prompt: `刪除當前選取的 ${selectedRowIds.length} 筆資料列`,
      label: `刪除選取的列`,
      category: 'selection'
    })
  }

  // 2. Select Fields: Batch fill empty values & distribution stats
  for (const sf of selectFields.slice(0, 2)) {
    const choices = extractChoices(sf.options)
    const choiceName = choices[0]?.name || choices[0]?.value
    if (choiceName) {
      result.push({
        prompt: `將所有尚未填寫「${sf.name}」的列設為「${choiceName}」`,
        label: `補齊「${sf.name}」空白`,
        category: 'fill'
      })
    }
    result.push({
      prompt: `統計這張表格目前的總筆數與各「${sf.name}」分佈`,
      label: `各「${sf.name}」分佈統計`,
      category: 'stat'
    })
  }

  // 3. Number / Rating Fields: Aggregates
  if (numberFields.length > 0) {
    const nf = numberFields[0]
    result.push({
      prompt: `計算所有資料「${nf.name}」的總和與平均數值`,
      label: `計算「${nf.name}」總和與平均`,
      category: 'stat'
    })
  }

  // 4. Boolean Fields: Ratio
  if (booleanFields.length > 0) {
    const bf = booleanFields[0]
    result.push({
      prompt: `統計「${bf.name}」為「是」與「否」的筆數與佔比`,
      label: `「${bf.name}」比率統計`,
      category: 'stat'
    })
  }

  // 5. Date Fields: Range queries
  if (dateFields.length > 0) {
    const df = dateFields[0]
    result.push({
      prompt: `列出「${df.name}」在近一週內需要留意的資料列`,
      label: `近一週「${df.name}」項目`,
      category: 'check'
    })
  }

  // 6. Intelligent Row Creation
  if (primaryField) {
    if (selectFields.length > 0) {
      const sf = selectFields[0]
      const choices = extractChoices(sf.options)
      const choiceName = choices[0]?.name || choices[0]?.value || '一般'
      result.push({
        prompt: `新增一筆「${primaryField.name}」為「新項目」且「${sf.name}」為「${choiceName}」的資料列`,
        label: `新增「${primaryField.name}」資料列`,
        category: 'create'
      })
    } else {
      result.push({
        prompt: `新增一筆「${primaryField.name}」為「新項目」的資料列`,
        label: `新增資料列`,
        category: 'create'
      })
    }
  }

  // 7. General Data Hygiene Check
  result.push({
    prompt: `檢查這張資料表是否有格式不完整、欄位空白或有異常的資料列`,
    label: `資料完整度體檢`,
    category: 'check'
  })

  // Fallback defaults if table has no custom fields yet
  if (result.length === 0) {
    return [
      { prompt: '統計這張表格目前的總人數與各組別分佈', label: '總人數與分佈統計', category: 'stat' },
      { prompt: '檢查這張資料表是否有格式不完整或空白遺漏的列', label: '格式完整度檢查', category: 'check' },
      { prompt: '新增一筆範例測試資料', label: '新增測試資料', category: 'create' },
    ]
  }

  // Deduplicate by prompt and take up to 5 items
  const seen = new Set<string>()
  const deduped: SmartPresetAction[] = []
  for (const item of result) {
    if (!seen.has(item.prompt)) {
      seen.add(item.prompt)
      deduped.push(item)
    }
    if (deduped.length >= 5) break
  }

  return deduped
}
