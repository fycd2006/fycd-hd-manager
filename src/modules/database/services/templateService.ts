import * as workspaceService from './workspace'

export type TemplateKey = 'project' | 'crm' | 'finance' | 'hr'

export interface TemplateConfig {
  dbName: string
  tableName: string
  fields: Array<{ name: string; type: string; options?: string }>
  sampleRows: Array<Record<string, any>>
}

export const TEMPLATE_CONFIGS: Record<TemplateKey, TemplateConfig> = {
  project: {
    dbName: '🚀 專案任務追蹤資料庫',
    tableName: '專案任務表',
    fields: [
      { name: '任務名稱', type: 'text' },
      { name: '狀態', type: 'single_select', options: JSON.stringify(['未開始', '進行中', '已完成']) },
      { name: '優先級', type: 'single_select', options: JSON.stringify(['低', '中', '高', '緊急']) },
      { name: '負責人', type: 'text' },
      { name: '截止日期', type: 'date' }
    ],
    sampleRows: [
      { field_1: '設計官網新版 UI 首頁', field_2: '進行中', field_3: '高', field_4: 'Alex', field_5: '2026-08-01' },
      { field_1: '撰寫資料庫 API 文件', field_2: '未開始', field_3: '中', field_4: 'Bob', field_5: '2026-08-05' },
      { field_1: '修復 Formula 欄位編輯', field_2: '已完成', field_3: '緊急', field_4: 'Carol', field_5: '2026-07-24' }
    ]
  },
  crm: {
    dbName: '💼 客戶關係 CRM 資料庫',
    tableName: '客戶資料表',
    fields: [
      { name: '客戶姓名', type: 'text' },
      { name: '公司名稱', type: 'text' },
      { name: '聯絡電話', type: 'text' },
      { name: '電子郵件', type: 'email' },
      { name: '交易金額', type: 'number' },
      { name: '狀態', type: 'single_select', options: JSON.stringify(['潛在客戶', '商談中', '已成交', '已流失']) }
    ],
    sampleRows: [
      { field_1: '陳大明', field_2: '鼎盛科技股份有限公司', field_3: '0912-345-678', field_4: 'dm@ds-tech.com', field_5: 150000, field_6: '已成交' },
      { field_1: '林美玲', field_2: '創新數位行銷', field_3: '0988-765-432', field_4: 'meiling@innovate.tw', field_5: 85000, field_6: '商談中' }
    ]
  },
  finance: {
    dbName: '💰 團隊財務記帳資料庫',
    tableName: '收支紀錄表',
    fields: [
      { name: '收支項目', type: 'text' },
      { name: '類別', type: 'single_select', options: JSON.stringify(['辦公採購', '差旅費', '行銷推廣', '軟體訂閱', '其他']) },
      { name: '金額', type: 'number' },
      { name: '日期', type: 'date' },
      { name: '付款方式', type: 'single_select', options: JSON.stringify(['信用卡', '轉帳', '現金']) }
    ],
    sampleRows: [
      { field_1: '伺服器 AWS 雲端託管費', field_2: '軟體訂閱', field_3: 12500, field_4: '2026-07-15', field_5: '信用卡' },
      { field_1: '團隊年中餐會', field_2: '辦公採購', field_3: 8800, field_4: '2026-07-20', field_5: '轉帳' }
    ]
  },
  hr: {
    dbName: '👥 人事資料通訊錄',
    tableName: '員工名冊',
    fields: [
      { name: '員工姓名', type: 'text' },
      { name: '部門', type: 'single_select', options: JSON.stringify(['研發部', '產品部', '行銷部', '財務部', '人資部']) },
      { name: '職稱', type: 'text' },
      { name: '入職日期', type: 'date' },
      { name: '聯絡電話', type: 'text' }
    ],
    sampleRows: [
      { field_1: '張家豪', field_2: '研發部', field_3: '資深軟體工程師', field_4: '2024-03-01', field_5: '0911-111-222' },
      { field_1: '黃雅婷', field_2: '產品部', field_3: '產品經理 (PM)', field_4: '2025-01-15', field_5: '0922-333-444' }
    ]
  }
}

/**
 * Creates a complete database from a preconfigured template.
 */
export async function createDatabaseFromTemplate(
  workspaceId: number,
  templateKey: TemplateKey
): Promise<{ ok: boolean; newTableId?: number; error?: string }> {
  const config = TEMPLATE_CONFIGS[templateKey]
  if (!config) return { ok: false, error: '未知的模板類型' }

  try {
    // 1. Create database
    const dbRes = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_database',
        workspaceId,
        name: config.dbName
      })
    })
    if (!dbRes.ok) throw new Error('建立資料庫失敗')
    const newDb = await dbRes.json()

    // 2. Create table
    const tableRes = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        databaseId: newDb.id,
        name: config.tableName
      })
    })
    if (!tableRes.ok) throw new Error('建立資料表失敗')
    const newTable = await tableRes.json()

    // 3. Create fields
    for (const f of config.fields) {
      await fetch(`/api/tables/${newTable.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f)
      })
    }

    // 4. Fetch created fields to map field keys
    const fieldsRes = await fetch(`/api/tables/${newTable.id}/fields`)
    const createdFields = fieldsRes.ok ? await fieldsRes.json() : []

    // 5. Create sample rows
    if (createdFields.length > 0) {
      for (const sample of config.sampleRows) {
        const rowData: Record<string, any> = {}
        config.fields.forEach((f, idx) => {
          const matchField = createdFields.find((cf: any) => cf.name === f.name)
          if (matchField) {
            const val = (sample as any)[`field_${idx + 1}`]
            if (val !== undefined) rowData[`field_${matchField.id}`] = val
          }
        })
        await fetch(`/api/tables/${newTable.id}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rowData)
        })
      }
    }

    return { ok: true, newTableId: newTable.id }
  } catch (err: any) {
    return { ok: false, error: err.message || '模板建立失敗' }
  }
}
