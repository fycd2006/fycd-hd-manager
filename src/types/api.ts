export interface ApiErrorResponse {
  error: string
}

export interface TableRowData {
  [key: string]: string | number | boolean | Array<string | number> | null | undefined
}

export interface TableFieldOptions {
  relationFieldId?: number
  targetFieldId?: number
  rollupFunction?: 'COUNT' | 'SUM' | 'AVERAGE' | 'MAX' | 'MIN' | 'CONCAT'
  formula?: string
  choices?: Array<{ id: string; name: string; color?: string }>
}

export interface UserSessionPayload {
  id: number
  username: string
  email: string
  role: string
}

export interface WorkspaceUserRole {
  workspaceId: number
  userId: number
  role: 'admin' | 'editor' | 'viewer'
  twoFactor?: boolean
}
