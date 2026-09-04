import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { triggerTableEvent } from '@/lib/pusher-server'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { GoogleGenAI, Type } from '@google/genai'

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
              value: { type: Type.STRING, description: '更新後的值。若是選項欄位，填入選項名稱或選項 ID' }
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

        await prisma.$transaction(async (tx) => {
          for (const u of updates) {
            const row = await tx.tableRow.findUnique({
              where: { id: u.rowId, tableId: tid, deletedAt: null }
            })
            if (!row) continue

            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : { ...(row.data as any || {}) }
            rowData[u.fieldKey] = u.value

            await tx.tableRow.update({
              where: { id: u.rowId },
              data: { data: rowData }
            })
          }
        })

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

        // Get max order in table
        const lastRow = await prisma.tableRow.findFirst({
          where: { tableId: tid, deletedAt: null },
          orderBy: { order: 'desc' },
          select: { order: true }
        })
        let nextOrder = (lastRow?.order ?? -1) + 1

        await prisma.$transaction(async (tx) => {
          for (const r of rows) {
            await tx.tableRow.create({
              data: {
                tableId: tid,
                order: nextOrder++,
                data: r
              }
            })
          }
        })

        await invalidateMasterViewCacheForTable(tid).catch(() => {})
        triggerTableEvent(tid, 'rows-batch-changed', { type: 'create', count: rows.length }, socketId || undefined)

        return NextResponse.json({
          success: true,
          action: 'create_rows',
          count: rows.length,
          summary: `成功新增 ${rows.length} 筆資料列`
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

    // Fetch existing rows snapshot (up to 200 rows)
    const existingRows = await prisma.tableRow.findMany({
      where: { tableId: tid, deletedAt: null },
      take: 200,
      orderBy: { order: 'asc' },
      select: { id: true, data: true, order: true }
    })

    const parsedRows = existingRows.map(r => {
      const dataObj = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as any || {})
      return { id: r.id, ...dataObj }
    })

    // Prepare clean schema explanation for the model
    const schemaDetails = fields.map(f => {
      let choicesList: any[] = []
      if (f.type === 'single_select' || f.type === 'multiple_select') {
        try {
          const opts = typeof f.options === 'string' ? JSON.parse(f.options) : f.options
          choicesList = opts?.choices || opts?.select_options || opts?.options || []
        } catch {}
      }
      return {
        fieldKey: `field_${f.id}`,
        name: f.name,
        type: f.type,
        optionsChoices: choicesList.map((c: any) => ({
          id: c.id,
          name: c.name || c.label || c.value
        }))
      }
    })

    const systemPrompt = `你是一個專業的高效資料庫自動化 AI 助理。
使用者的資料表欄位定義 (Schema) 如下：
${JSON.stringify(schemaDetails, null, 2)}

現有資料列 (最多 200 筆快照，id 代表 rowId，欄位對應 fieldKey)：
${JSON.stringify(parsedRows, null, 2)}

【操作原則】
1. 請嚴格根據使用者指令呼叫最適當的工具 (update_cells, create_rows, 或 delete_rows)。
2. 在 update_cells 或 create_rows 中，請務必使用標準 fieldKey (例如 field_${fields[0].id})。
3. 若欄位為 single_select 或 multiple_select，請優先填入定義好的選項名稱（或選項 ID）。
4. 如果使用者的需求無法透過上述工具達成，或只是在打招呼、提問，請直接以繁體中文回答，不需要呼叫任何工具。`

    const ai = new GoogleGenAI({ apiKey })
    const candidateModels = Array.from(
      new Set([
        process.env.GEMINI_MODEL,
        'gemini-flash-latest',
        'gemini-2.5-flash-lite',
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
      parsedRows.forEach(r => rowLookup.set(r.id, r))

      const formattedChanges = rawUpdates.map(u => {
        const targetRow = rowLookup.get(u.rowId)
        const targetField = fieldMap.get(u.fieldKey)
        const rowTitle = targetRow?.[primaryFieldKey] || `列 #${u.rowId}`
        const fieldName = targetField?.name || u.fieldKey
        const oldValue = targetRow?.[u.fieldKey] ?? '(空白)'

        return {
          rowId: u.rowId,
          rowTitle: String(rowTitle),
          fieldKey: u.fieldKey,
          fieldName,
          oldValue: String(oldValue),
          newValue: String(u.value)
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
          mapped[name] = v
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
