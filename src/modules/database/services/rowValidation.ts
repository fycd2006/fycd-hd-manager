import { z } from 'zod'

export interface FieldValidationMeta {
  id: number
  name: string
  type: string
  options?: any
}

export function validateRowPatchPayload(
  updateMap: Record<string, any>,
  fields: FieldValidationMeta[]
): { valid: true; parsedData: Record<string, any> } | { valid: false; error: string } {
  const fieldMap = new Map(fields.map(f => [`field_${f.id}`, f]))

  for (const [key, val] of Object.entries(updateMap)) {
    if (!key.startsWith('field_')) continue
    const field = fieldMap.get(key)
    if (!field) continue

    if (val === null || val === undefined || val === '') {
      continue
    }

    switch (field.type) {
      case 'number':
      case 'rating':
      case 'percent':
      case 'currency':
      case 'autonumber': {
        const numSchema = z.union([
          z.number(),
          z.string().refine((s) => !isNaN(Number(s)) && s.trim() !== '', {
            message: `欄位 [${field.name}] 必須為數值型態`
          })
        ])
        const res = numSchema.safeParse(val)
        if (!res.success) {
          return { valid: false, error: `欄位 [${field.name}] 型態驗證失敗: 必須為數字，收到「${val}」` }
        }
        break
      }
      case 'boolean': {
        const boolSchema = z.union([
          z.boolean(),
          z.literal(0),
          z.literal(1),
          z.literal('true'),
          z.literal('false'),
        ])
        const res = boolSchema.safeParse(val)
        if (!res.success) {
          return { valid: false, error: `欄位 [${field.name}] 型態驗證失敗: 必須為布林值 (true/false)` }
        }
        break
      }
      case 'date':
      case 'created_on':
      case 'last_modified_on': {
        const dateSchema = z.union([
          z.date(),
          z.string().refine((s) => !isNaN(new Date(s).getTime()), {
            message: `欄位 [${field.name}] 必須為有效日期格式`
          })
        ])
        const res = dateSchema.safeParse(val)
        if (!res.success) {
          return { valid: false, error: `欄位 [${field.name}] 型態驗證失敗: 必須為有效日期格式` }
        }
        break
      }
      case 'email': {
        if (typeof val === 'string' && val.trim() !== '') {
          const emailSchema = z.string().email({ message: `欄位 [${field.name}] 格式不符合電子郵件格式` })
          const res = emailSchema.safeParse(val.trim())
          if (!res.success) {
            return { valid: false, error: `欄位 [${field.name}] 格式不符合電子郵件格式: 「${val}」` }
          }
        }
        break
      }
      case 'url': {
        if (typeof val === 'string' && val.trim() !== '') {
          const urlSchema = z.string().url().or(
            z.string().regex(/^(https?:\/\/|www\.)/i)
          )
          const res = urlSchema.safeParse(val.trim())
          if (!res.success) {
            return { valid: false, error: `欄位 [${field.name}] 必須為有效網址: 「${val}」` }
          }
        }
        break
      }
      case 'link_row': {
        const linkRowSchema = z.union([
          z.array(z.union([z.number(), z.string(), z.object({ id: z.union([z.number(), z.string()]) })])),
          z.string(),
          z.number()
        ])
        const res = linkRowSchema.safeParse(val)
        if (!res.success) {
          return { valid: false, error: `欄位 [${field.name}] 關聯格式錯誤` }
        }
        break
      }
      default:
        break
    }
  }

  return { valid: true, parsedData: updateMap }
}
