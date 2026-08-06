import { getRolePermissions } from '../permissions'

describe('Role Permissions Unit Tests', () => {
  it('should return correct permissions for admin role', () => {
    const perm = getRolePermissions('admin')
    expect(perm.canManageWorkspace).toBe(true)
    expect(perm.canManageMembers).toBe(true)
    expect(perm.canManageStructure).toBe(true)
    expect(perm.canManageViews).toBe(true)
    expect(perm.canEditData).toBe(true)
    expect(perm.canComment).toBe(true)
  })

  it('should return correct permissions for builder role', () => {
    const perm = getRolePermissions('builder')
    expect(perm.canManageWorkspace).toBe(false)
    expect(perm.canManageMembers).toBe(false)
    expect(perm.canManageStructure).toBe(true)
    expect(perm.canManageViews).toBe(true)
    expect(perm.canEditData).toBe(true)
    expect(perm.canComment).toBe(true)
  })

  it('should return correct permissions for editor role', () => {
    const perm = getRolePermissions('editor')
    expect(perm.canManageWorkspace).toBe(false)
    expect(perm.canManageMembers).toBe(false)
    expect(perm.canManageStructure).toBe(false)
    expect(perm.canManageViews).toBe(true)
    expect(perm.canEditData).toBe(true)
    expect(perm.canComment).toBe(true)
  })

  it('should return correct permissions for commenter role', () => {
    const perm = getRolePermissions('commenter')
    expect(perm.canManageWorkspace).toBe(false)
    expect(perm.canManageMembers).toBe(false)
    expect(perm.canManageStructure).toBe(false)
    expect(perm.canManageViews).toBe(false)
    expect(perm.canEditData).toBe(false)
    expect(perm.canComment).toBe(true)
  })

  it('should return restrictive permissions for viewer role and unknown roles', () => {
    const viewerPerm = getRolePermissions('viewer')
    expect(viewerPerm.canEditData).toBe(false)
    expect(viewerPerm.canComment).toBe(false)

    const unknownPerm = getRolePermissions('unknown_role')
    expect(unknownPerm.canEditData).toBe(false)
    expect(unknownPerm.canComment).toBe(false)
  })
})
