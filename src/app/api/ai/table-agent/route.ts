import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { triggerTableEvent } from '@/lib/pusher-server'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { GoogleGenAI, Type } from '@google/genai'
import { FieldRegistry, extractChoices, parseLatestCommentEntries } from '@/modules/database/fields/types'
import { evaluateFormula, extractFormulaExpression } from '@/lib/formula'
import { cascadeRecomputeSingleLevel } from '@/modules/database/services/rowCascade'
import { syncBiDirectionalLinkRow, parseLinkRowIds } from '@/modules/database/services/linkRowSync'
import { createTableRow } from '@/modules/database/services/createRow'
import { safeJsonParse } from '@/lib/json-utils'

const READONLY_TYPES = new Set([
  'formula',
  'autonumber',
  'lookup',
  'rollup',
  'count',
  'created_on',
  'last_modified_on',
  'created_by',
  'last_modified_by',
])

function formatValueForDisplay(val: any, field?: any): string {
  if (val === null || val === undefined || val === '') return '(空白)'
  if (!field) return String(val)

  if (field.type === 'single_select' || field.type === 'multiple_select') {
    const choices = extractChoices(field.options)
    if (choices.length > 0) {
      let items: string[] = []
      if (Array.isArray(val)) {
        items = val.map(String)
      } else if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) items = parsed.map(String)
          else items = [val]
        } catch {
          items = val.split(',').map(s => s.trim()).filter(Boolean)
        }
      } else {
        items = [String(val)]
      }

      const labelList = items.map(item => {
        const itemTrimmed = String(item).trim()
        const itemLower = itemTrimmed.toLowerCase()
        const choice = choices.find((c: any) => {
          if (!c) return false
          if (typeof c === 'string') return c.trim() === itemTrimmed || c.trim().toLowerCase() === itemLower
          const cId = c.id != null ? String(c.id).trim() : ''
          const cName = c.name != null ? String(c.name).trim() : ''
          const cVal = c.value != null ? String(c.value).trim() : ''
          return (cId && (cId === itemTrimmed || cId.toLowerCase() === itemLower)) ||
                 (cName && (cName === itemTrimmed || cName.toLowerCase() === itemLower)) ||
                 (cVal && (cVal === itemTrimmed || cVal.toLowerCase() === itemLower))
        })
        return choice ? (typeof choice === 'string' ? choice : (choice.name || choice.id)) : itemTrimmed
      })
      return labelList.join(', ') || '(空白)'
    }
  }

  if (field.type === 'boolean') {
    if (val === true || val === 'true' || val === '1' || val === 'yes' || val === '是') return '是'
    if (val === false || val === 'false' || val === '0' || val === 'no' || val === '否') return '否'
  }

  if (field.type === 'latest_comment') {
    const entries = parseLatestCommentEntries(val)
    if (entries.length === 0) {
      if (typeof val === 'string' && val.trim() && !val.trim().startsWith('[')) {
        return val.trim()
      }
      return '(無留言)'
    }
    const latest = entries[entries.length - 1]
    const countNote = entries.length > 1 ? ` (共 ${entries.length} 則)` : ''
    return `[${latest.user || '留言'}] ${latest.content || ''}${countNote}`
  }

  return String(val)
}

// Function Calling declarations for Gemini
const tableTools: any[] = [
  {
    name: 'update_cells',
    description: '批次更新或修改既有資料列的儲存格內容',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: '本次修改的原因或摘要說明（繁體中文），例如：將所有未分組的資料列設為建興組' },
        updates: {
          type: Type.ARRAY,
          description: '要更新的儲存格列表',
          items: {
            type: Type.OBJECT,
            properties: {
              rowId: { type: Type.INTEGER, description: '目標資料列的 ID (數字)' },
              fieldKey: { type: Type.STRING, description: '目標欄位的 key，例如 field_1, field_2' },
              value: { type: Type.STRING, description: '更新後的值。若為單選/多選填入選項名稱或 ID；若為最新留言欄位填入欲新增的留言備註文字；若為核取方塊填入 true/false 或 是/否' }
            },
            required: ['rowId', 'fieldKey', 'value']
          }
        }
      },
      required: ['reason', 'updates']
    }
  },
  {
    name: 'create_rows',
    description: '新增一筆或多筆資料列到表格中',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: '新增資料的原因或摘要說明（繁體中文）' },
        rows: {
          type: Type.ARRAY,
          description: '要新增的列資料清單，每個物件的 key 為 fieldKey（如 field_1），值為儲存格字串或數值',
          items: {
            type: Type.OBJECT,
            description: '以 fieldKey 為鍵的儲存格物件'
          }
        }
      },
      required: ['reason', 'rows']
    }
  },
  {
    name: 'delete_rows',
    description: '批次刪除符合條件的一筆或多筆資料列',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: '刪除資料的原因或摘要說明（繁體中文），例如：刪除狀態為已結案的資料列' },
        rowIds: {
          type: Type.ARRAY,
          items: { type: Type.INTEGER },
          description: '要刪除的 rowId 陣列'
        }
      },
      required: ['reason', 'rowIds']
    }
  }
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tableId, userPrompt, messages = [], mode = 'dry_run', confirmedAction, socketId } = body
    const tid = Number(tableId)

    if (isNaN(tid)) {
      return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })
    }

    // 1. Check authorization
    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canEditData' })
    if (errorResponse) return errorResponse

    // 2. Fetch table fields & field map
    const fields = await prisma.tableField.findMany({
      where: { tableId: tid, deletedAt: null },
      orderBy: { order: 'asc' },
    })

    if (fields.length === 0) {
      return NextResponse.json({ error: '此資料表尚未建立任何欄位' }, { status: 400 })
    }

    const fieldMap = new Map<string, typeof fields[0]>()
    fields.forEach(f => {
      fieldMap.set(`field_${f.id}`, f)
      fieldMap.set(String(f.id), f)
    })

    const primaryFieldKey = `field_${fields[0].id}`

    // -------------------------------------------------------------
    // MODE: EXECUTE (User clicked "Apply" on the Diff Modal)
    // -------------------------------------------------------------
    if (mode === 'execute' && confirmedAction) {
      const { name, args } = confirmedAction

      if (name === 'update_cells') {
        const updates = (args.updates || []) as Array<{ rowId: number; fieldKey: string; value: any }>
        if (updates.length === 0) {
          return NextResponse.json({ error: '沒有需要更新的儲存格' }, { status: 400 })
        }

        const linkRowSyncTasks: Array<Promise<any>> = []
        const updatedRowIds = new Set<number>()

        // Group updates by rowId so multiple cell changes on the same row are applied together
        const updatesByRow = new Map<number, Array<{ fieldKey: string; value: any }>>()
        for (const u of updates) {
          const list = updatesByRow.get(u.rowId) || []
          list.push(u)
          updatesByRow.set(u.rowId, list)
        }

        await prisma.$transaction(async (tx) => {
          for (const [rowId, rowUpdates] of updatesByRow.entries()) {
            const row = await tx.tableRow.findUnique({
              where: { id: rowId, tableId: tid, deletedAt: null }
            })
            if (!row) continue

            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : { ...(row.data as any || {}) }

            for (const u of rowUpdates) {
              const targetField = fieldMap.get(u.fieldKey)
              if (!targetField) continue

              // Protect read-only / computed fields
              if (READONLY_TYPES.has(targetField.type)) continue

              const oldVal = rowData[u.fieldKey]
              let validatedValue = u.value

              if (targetField.type === 'link_row') {
                const oldIds = parseLinkRowIds(oldVal)
                const newIds = parseLinkRowIds(u.value)
                validatedValue = newIds
                linkRowSyncTasks.push(
                  syncBiDirectionalLinkRow(tid, rowId, targetField.id, newIds, oldIds).catch(err => {
                    console.warn('[Bi-directional Sync Warning in AI Agent]:', err)
                    return null
                  })
                )
              } else if (targetField.type === 'latest_comment') {
                const existingEntries = parseLatestCommentEntries(oldVal)
                if (u.value === null || u.value === undefined || u.value === '') {
                  validatedValue = []
                } else if (Array.isArray(u.value)) {
                  validatedValue = u.value
                } else if (typeof u.value === 'string') {
                  const trimmed = u.value.trim()
                  try {
                    const parsed = JSON.parse(trimmed)
                    if (Array.isArray(parsed)) {
                      validatedValue = parsed
                    } else {
                      validatedValue = [
                        ...existingEntries,
                        {
                          id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
                          user: 'AI 助理 (AI Assistant)',
                          time: new Date().toLocaleString('zh-TW', { hour12: false }),
                          content: trimmed,
                        },
                      ]
                    }
                  } catch {
                    validatedValue = [
                      ...existingEntries,
                      {
                        id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
                        user: 'AI 助理 (AI Assistant)',
                        time: new Date().toLocaleString('zh-TW', { hour12: false }),
                        content: trimmed,
                      },
                    ]
                  }
                } else if (typeof u.value === 'object' && u.value !== null) {
                  validatedValue = [
                    ...existingEntries,
                    {
                      id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
                      user: u.value.user || 'AI 助理 (AI Assistant)',
                      time: u.value.time || new Date().toLocaleString('zh-TW', { hour12: false }),
                      content: String(u.value.content || ''),
                    },
                  ]
                }
              } else {
                const fOpts = typeof targetField.options === 'string'
                  ? safeJsonParse(targetField.options, {})
                  : (targetField.options || {})
                const fieldType = FieldRegistry.get(targetField.type)
                const validateRes = fieldType.validateValue(u.value, fOpts)
                if (validateRes.valid) {
                  validatedValue = validateRes.parsedValue
                }
              }

              rowData[u.fieldKey] = validatedValue
            }

            // Recompute formula fields if present in table
            const formulaFields = fields.filter(f => f.type === 'formula')
            if (formulaFields.length > 0) {
              const fieldOrder = fields.map(f => f.id)
              for (const ff of formulaFields) {
                const destKey = `field_${ff.id}`
                const expr = extractFormulaExpression(ff.options)
                if (!expr) continue
                try {
                  const res = evaluateFormula(expr, rowData, fieldOrder)
                  rowData[destKey] = res != null ? String(res) : ''
                } catch {
                  rowData[destKey] = '#VALUE!'
                }
              }
            }

            await tx.tableRow.update({
              where: { id: rowId },
              data: { data: rowData }
            })

            updatedRowIds.add(rowId)
          }
        })

        // Run single-level cascade recomputations for modified rows
        for (const rid of updatedRowIds) {
          await cascadeRecomputeSingleLevel(tid, rid).catch(err => {
            console.warn('[Cascade Recompute Warning in AI Agent]:', err)
          })
        }

        if (linkRowSyncTasks.length > 0) {
          await Promise.allSettled(linkRowSyncTasks)
        }

        await invalidateMasterViewCacheForTable(tid).catch(() => {})
        triggerTableEvent(tid, 'rows-batch-changed', { type: 'update', count: updates.length }, socketId || undefined)

        return NextResponse.json({
          success: true,
          action: 'update_cells',
          count: updates.length,
          summary: `成功更新 ${updates.length} 個儲存格`
        })
      }

      if (name === 'create_rows') {
        const rows = (args.rows || []) as Array<Record<string, any>>
        if (rows.length === 0) {
          return NextResponse.json({ error: '沒有需要新增的資料列' }, { status: 400 })
        }

        const createdRows: any[] = []
        for (const r of rows) {
          const result = await createTableRow({
            tableId: tid,
            input: r,
            username: 'AI 助理 (AI Assistant)',
          })
          if (result.ok) {
            createdRows.push(result.row)
          } else {
            console.warn('[AI createTableRow warning]:', result.error)
          }
        }

        if (createdRows.length === 0) {
          return NextResponse.json({ error: '新增資料列失敗' }, { status: 500 })
        }

        await invalidateMasterViewCacheForTable(tid).catch(() => {})
        triggerTableEvent(tid, 'rows-batch-changed', { type: 'create', count: createdRows.length }, socketId || undefined)

        return NextResponse.json({
          success: true,
          action: 'create_rows',
          count: createdRows.length,
          summary: `成功新增 ${createdRows.length} 筆資料列`
        })
      }

      if (name === 'delete_rows') {
        const rowIds = (args.rowIds || []) as number[]
        if (rowIds.length === 0) {
          return NextResponse.json({ error: '沒有需要刪除的資料列' }, { status: 400 })
        }

        await prisma.tableRow.updateMany({
          where: { id: { in: rowIds }, tableId: tid },
          data: { deletedAt: new Date() }
        })

        await invalidateMasterViewCacheForTable(tid).catch(() => {})
        triggerTableEvent(tid, 'rows-batch-changed', { type: 'delete', count: rowIds.length }, socketId || undefined)

        return NextResponse.json({
          success: true,
          action: 'delete_rows',
          count: rowIds.length,
          summary: `成功刪除 ${rowIds.length} 筆資料列`
        })
      }

      return NextResponse.json({ error: '未知的操作指令' }, { status: 400 })
    }

    // -------------------------------------------------------------
    // MODE: DRY RUN (Call Gemini 2.0 Flash with tools & return Diff)
    // -------------------------------------------------------------
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: '尚未設定 GEMINI_API_KEY。請前往 Google AI Studio (https://aistudio.google.com/) 取得免費金鑰，並在 .env 中加入 GEMINI_API_KEY="您的金鑰"。'
      }, { status: 400 })
    }

    if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
      return NextResponse.json({ error: '請輸入指令內容' }, { status: 400 })
    }

    // Fetch compact existing rows snapshot (up to 60 active rows)
    const existingRows = await prisma.tableRow.findMany({
      where: { tableId: tid, deletedAt: null },
      take: 60,
      orderBy: { order: 'asc' },
      select: { id: true, data: true }
    })

    // Compact row data: omit empty/null cells to drastically reduce token payload and speed up LLM processing
    const parsedRows = existingRows.map(r => {
      const dataObj = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as any || {})
      const compactRow: Record<string, any> = { id: r.id }
      for (const [k, v] of Object.entries(dataObj)) {
        if (v !== null && v !== undefined && v !== '') {
          const field = fieldMap.get(k)
          if (field?.type === 'latest_comment') {
            const entries = parseLatestCommentEntries(v)
            if (entries.length > 0) {
              const latest = entries[entries.length - 1]
              compactRow[k] = latest.content
            }
          } else {
            compactRow[k] = v
          }
        }
      }
      return compactRow
    })

    // Prepare clean, compact schema explanation
    const schemaDetails = fields.map(f => {
      let choicesList: any[] = []
      if (f.type === 'single_select' || f.type === 'multiple_select') {
        choicesList = extractChoices(f.options)
      }
      return {
        fieldKey: `field_${f.id}`,
        name: f.name,
        type: f.type,
        isReadOnly: READONLY_TYPES.has(f.type),
        optionsChoices: choicesList.map((c: any) => ({
          id: c.id,
          name: c.name || c.label || c.value
        }))
      }
    })

    const systemPrompt = `你是一個專業的高效資料庫自動化 AI 助理。
欄位定義 (Schema):
${JSON.stringify(schemaDetails)}

資料快照 (id 為 rowId，欄位對應 fieldKey):
${JSON.stringify(parsedRows)}

【操作原則】
1. 請嚴格根據使用者指令呼叫最適當的工具 (update_cells, create_rows, 或 delete_rows)。
2. 在 update_cells 或 create_rows 中，請務必使用標準 fieldKey (例如 field_${fields[0].id})。
3. 特殊欄位填寫規範：
   - single_select (單選) / multiple_select (多選)：請優先填入定義好的選項名稱（例如「建興組」）或選項 ID。若是多選，填入選項名稱陣列或逗號分隔字串。
   - latest_comment (最新留言紀錄)：請直接填入欲新增的留言備註文字（例如「今日已完成訪談」），系統會自動附帶時間戳記與署名並保留歷史紀錄；若使用者要求清空留言，填入 ""。
   - boolean (核取方塊)：請填入 true / false 或 是 / 否。
   - number (數字) / rating (評分)：請填入數值。
   - link_row (關聯資料)：請填入目標關聯列的 ID 數字陣列（例如 [1, 2]）。
   - isReadOnly: true 之欄位（formula 公式、autonumber 自動編號、lookup、rollup、count、建立/修改時間等）：為系統自動運算的唯讀欄位，嚴禁直接修改！若使用者要求修改公式或計算結果，請改為修改該公式所引用的原始資料欄位。
4. 如果使用者的需求無法透過上述工具達成，或只是在打招呼、提問，請直接以繁體中文回答，不需要呼叫任何工具。`

    const ai = new GoogleGenAI({ apiKey })
    const candidateModels = Array.from(
      new Set([
        process.env.GEMINI_MODEL,
        'gemini-3.1-flash-lite-preview',
        'gemini-3.5-flash',
        'gemini-3.6-flash'
      ].filter(Boolean) as string[])
    )

    // Build conversation contents for multi-turn chat
    const conversationContents: any[] = []
    if (Array.isArray(messages) && messages.length > 0) {
      const sliced = messages.slice(-10)
      for (const m of sliced) {
        if (!m || typeof m.content !== 'string' || !m.content.trim()) continue
        const role = m.role === 'user' ? 'user' : 'model'
        conversationContents.push({
          role,
          parts: [{ text: m.content.trim() }]
        })
      }
    }

    const currentQuery = (userPrompt || '').trim()
    if (currentQuery) {
      conversationContents.push({
        role: 'user',
        parts: [{ text: currentQuery }]
      })
    }

    if (conversationContents.length === 0) {
      return NextResponse.json({ error: '請提供有效指令或對話內容' }, { status: 400 })
    }

    let response: any = null
    let lastError: any = null

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: conversationContents,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: tableTools }],
            temperature: 0.1
          }
        })
        if (response) break
      } catch (err: any) {
        lastError = err
        console.warn(`[AI Table Agent] Model ${modelName} encountered error, trying next fallback:`, err?.message || err)
        const errMsg = String(err?.message || '')
        if (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('UNAVAILABLE')) {
          await new Promise(res => setTimeout(res, 600))
        }
      }
    }

    if (!response) {
      throw lastError || new Error('所有 AI 備援模型目前均連線異常，請稍後再試。')
    }

    const functionCalls = response.functionCalls
    if (!functionCalls || functionCalls.length === 0) {
      return NextResponse.json({
        type: 'text_reply',
        message: response.text || 'AI 無法從您的指令識別需要執行的資料表變更操作，請嘗試更具體的描述。',
        actionPayload: null
      })
    }

    const call = functionCalls[0]
    const callName = call.name
    const callArgs: any = call.args || {}

    // Construct human-readable preview diff
    if (callName === 'update_cells') {
      const rawUpdates = (callArgs.updates || []) as Array<{ rowId: number; fieldKey: string; value: any }>
      const rowLookup = new Map<number, any>()
      existingRows.forEach(r => {
        const dataObj = typeof r.data === 'string' ? safeJsonParse(r.data, {}) : (r.data || {})
        rowLookup.set(r.id, dataObj)
      })

      const formattedChanges = rawUpdates.map(u => {
        const targetRow = rowLookup.get(u.rowId)
        const targetField = fieldMap.get(u.fieldKey)
        const rowTitle = targetRow?.[primaryFieldKey] || `列 #${u.rowId}`
        const fieldName = targetField?.name || u.fieldKey
        const rawOldValue = targetRow?.[u.fieldKey]
        const oldValue = formatValueForDisplay(rawOldValue, targetField)
        const newValue = formatValueForDisplay(u.value, targetField)

        return {
          rowId: u.rowId,
          rowTitle: String(rowTitle),
          fieldKey: u.fieldKey,
          fieldName,
          oldValue,
          newValue
        }
      })

      return NextResponse.json({
        type: 'diff_preview',
        action: 'update_cells',
        reason: callArgs.reason || `預計修改 ${formattedChanges.length} 個儲存格`,
        changes: formattedChanges,
        actionPayload: {
          name: 'update_cells',
          args: callArgs
        }
      })
    }

    if (callName === 'create_rows') {
      const rawRows = (callArgs.rows || []) as Array<Record<string, any>>
      const previewRows = rawRows.map(r => {
        const mapped: Record<string, any> = {}
        for (const [k, v] of Object.entries(r)) {
          const field = fieldMap.get(k)
          const name = field ? field.name : k
          mapped[name] = formatValueForDisplay(v, field)
        }
        return mapped
      })

      return NextResponse.json({
        type: 'diff_preview',
        action: 'create_rows',
        reason: callArgs.reason || `預計新增 ${rawRows.length} 筆資料`,
        newRows: previewRows,
        actionPayload: {
          name: 'create_rows',
          args: callArgs
        }
      })
    }

    if (callName === 'delete_rows') {
      const rowIds = (callArgs.rowIds || []) as number[]
      const rowLookup = new Map<number, any>()
      parsedRows.forEach(r => rowLookup.set(r.id, r))

      const deletedItems = rowIds.map(id => {
        const targetRow = rowLookup.get(id)
        const rowTitle = targetRow?.[primaryFieldKey] || `列 #${id}`
        return {
          id,
          title: String(rowTitle)
        }
      })

      return NextResponse.json({
        type: 'diff_preview',
        action: 'delete_rows',
        reason: callArgs.reason || `預計刪除 ${rowIds.length} 筆資料`,
        deletedRows: deletedItems,
        actionPayload: {
          name: 'delete_rows',
          args: callArgs
        }
      })
    }

    return NextResponse.json({
      type: 'text_reply',
      message: response.text || '完成指令分析。',
      actionPayload: null
    })
  } catch (error: any) {
    console.error('[AI Table Agent Error]:', error)
    let raw = String(error?.message || '')
    let userFriendlyMsg = 'AI 處理請求時發生錯誤，請稍後再試。'

    if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
      userFriendlyMsg = 'Google AI 伺服器目前尖峰忙線中 (503 High Demand)，已嘗試自動備援重試。請稍候 3~5 秒後再次點擊送出。'
    } else if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
      userFriendlyMsg = 'Google AI 免費額度呼叫頻率已達上限 (429 Rate Limit)，請稍候 10 秒後重試。'
    } else if (error?.message) {
      userFriendlyMsg = error.message
    }

    return NextResponse.json({
      error: userFriendlyMsg
    }, { status: 500 })
  }
}
