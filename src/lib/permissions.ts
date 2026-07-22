export interface RolePermissions {
  role: string
  canManageWorkspace: boolean  // 刪除工作區、變更工作區名稱
  canManageMembers: boolean    // 邀請成員、更新角色權限、移除成員
  canManageStructure: boolean  // 新增/修改/刪除資料庫、資料表、欄位
  canManageViews: boolean      // 新增/修改/刪除檢視表 (Filters, Sorts, Colors)
  canEditData: boolean         // 新增/編輯/刪除資料列與儲存格數值
  canComment: boolean          // 新增資料列留言評論
}

export function getRolePermissions(role?: string): RolePermissions {
  const normalizedRole = (role || 'viewer').toLowerCase()
  
  switch (normalizedRole) {
    case 'admin':
      return {
        role: 'admin',
        canManageWorkspace: true,
        canManageMembers: true,
        canManageStructure: true,
        canManageViews: true,
        canEditData: true,
        canComment: true
      }
    case 'builder':
      return {
        role: 'builder',
        canManageWorkspace: false,
        canManageMembers: false,
        canManageStructure: true,
        canManageViews: true,
        canEditData: true,
        canComment: true
      }
    case 'editor':
      return {
        role: 'editor',
        canManageWorkspace: false,
        canManageMembers: false,
        canManageStructure: false,
        canManageViews: true,
        canEditData: true,
        canComment: true
      }
    case 'commenter':
      return {
        role: 'commenter',
        canManageWorkspace: false,
        canManageMembers: false,
        canManageStructure: false,
        canManageViews: false,
        canEditData: false,
        canComment: true
      }
    case 'viewer':
    default:
      return {
        role: 'viewer',
        canManageWorkspace: false,
        canManageMembers: false,
        canManageStructure: false,
        canManageViews: false,
        canEditData: false,
        canComment: false
      }
  }
}
