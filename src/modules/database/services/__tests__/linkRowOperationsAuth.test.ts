import { NextResponse } from 'next/server'
import { authorizeLinkRowOperation, LinkRowOperationType } from '../linkRowOperations'
import { authorizeAction } from '@/lib/authorize'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

type PermissionLevel = 'none' | 'view' | 'edit'

interface MatrixTestCase {
  operation: LinkRowOperationType
  sourcePermission: PermissionLevel
  targetPermission: PermissionLevel
  expectedAllowed: boolean
  expectedStatusCode?: number
  description: string
}

describe('Phase 2.3 Parameterized Permission Matrix: Source Table Perm x Target Table Perm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Complete parameterization covering all combinations of the permission matrix
  const matrixCases: MatrixTestCase[] = [
    // --- View Card ---
    {
      operation: 'view',
      sourcePermission: 'view',
      targetPermission: 'view',
      expectedAllowed: true,
      description: 'View: Allowed when target has canViewData',
    },
    {
      operation: 'view',
      sourcePermission: 'view',
      targetPermission: 'none',
      expectedAllowed: false,
      expectedStatusCode: 403,
      description: 'View: Blocked with 403 when target has no permission',
    },

    // --- In-place Edit ---
    {
      operation: 'edit',
      sourcePermission: 'view',
      targetPermission: 'edit',
      expectedAllowed: true,
      description: 'Edit: Allowed when target has canEditData (even if source is read-only)',
    },
    {
      operation: 'edit',
      sourcePermission: 'edit',
      targetPermission: 'view',
      expectedAllowed: false,
      expectedStatusCode: 403,
      description: 'Edit: Blocked with 403 when target only has canViewData',
    },
    {
      operation: 'edit',
      sourcePermission: 'edit',
      targetPermission: 'none',
      expectedAllowed: false,
      expectedStatusCode: 403,
      description: 'Edit: Blocked with 403 when target has no permission',
    },

    // --- Detach (Unlink) ---
    {
      operation: 'detach',
      sourcePermission: 'edit',
      targetPermission: 'none',
      expectedAllowed: true,
      description: 'Detach: Allowed when source has canEditData, even if target table has no permission',
    },
    {
      operation: 'detach',
      sourcePermission: 'edit',
      targetPermission: 'view',
      expectedAllowed: true,
      description: 'Detach: Allowed when source has canEditData and target has canViewData',
    },
    {
      operation: 'detach',
      sourcePermission: 'view',
      targetPermission: 'edit',
      expectedAllowed: false,
      expectedStatusCode: 403,
      description: 'Detach: Blocked with 403 when source is read-only (cannot modify source row)',
    },

    // --- Link Existing ---
    {
      operation: 'link_existing',
      sourcePermission: 'edit',
      targetPermission: 'view',
      expectedAllowed: true,
      description: 'Link Existing: Allowed when source has canEditData and target has canViewData',
    },
    {
      operation: 'link_existing',
      sourcePermission: 'edit',
      targetPermission: 'none',
      expectedAllowed: false,
      expectedStatusCode: 403,
      description: 'Link Existing (Blind linking): Blocked with 403 when target has no permission',
    },
    {
      operation: 'link_existing',
      sourcePermission: 'view',
      targetPermission: 'view',
      expectedAllowed: false,
      expectedStatusCode: 403,
      description: 'Link Existing: Blocked with 403 when source is read-only',
    },
  ]

  matrixCases.forEach((tc, index) => {
    it(`Case #${index + 1}: [${tc.operation.toUpperCase()}] Source: ${tc.sourcePermission}, Target: ${tc.targetPermission} -> ${tc.description}`, async () => {
      // Setup mock behavior for authorizeAction based on test parameters
      ;(authorizeAction as jest.Mock).mockImplementation(async ({ tableId, action }) => {
        const isSource = tableId === 10
        const isTarget = tableId === 20
        const currentLevel = isSource ? tc.sourcePermission : isTarget ? tc.targetPermission : 'none'

        if (currentLevel === 'none') {
          return { errorResponse: NextResponse.json({ error: '無權限' }, { status: 403 }) }
        }
        if (currentLevel === 'view' && action === 'canEditData') {
          return { errorResponse: NextResponse.json({ error: '唯讀無法編輯' }, { status: 403 }) }
        }
        return { auth: { user: { id: 1 }, role: 'member' } }
      })

      const res = await authorizeLinkRowOperation({
        operation: tc.operation,
        sourceTableId: 10,
        targetTableId: 20,
      })

      expect(res.allowed).toBe(tc.expectedAllowed)
      if (!tc.expectedAllowed && tc.expectedStatusCode) {
        expect(res.errorResponse?.status).toBe(tc.expectedStatusCode)
      }
    })
  })
})
