import { authorizeAction } from '../src/lib/authorize'
import { getMultiTableRows } from '../src/modules/database/services/multiTableQuery'
import { NextResponse } from 'next/server'

// Mocking dependencies is hard in a quick script, let's just write a test function 
// that simulates the exact logic used in route.ts, but we inject a mocked authorizeAction.
async function simulateRouteTsLogic(workspaceId: number, rawTableIds: number[], mockAuthorizeAction: any) {
    const authorizedTableIds: number[] = []
    
    console.log(`[Phase 0 Pre-filter] Checking ${rawTableIds.length} tables:`, rawTableIds)
    for (const tid of rawTableIds) {
      const { errorResponse: tableErr } = await mockAuthorizeAction({ tableId: tid, action: 'canViewData' })
      if (!tableErr) {
        authorizedTableIds.push(tid)
        console.log(`✅ Table ${tid}: Authorized`)
      } else {
        console.log(`❌ Table ${tid}: Unauthorized -> Excluded`)
      }
    }

    if (authorizedTableIds.length === 0) {
      console.log("No authorized tables found, returning empty result.")
      return { rows: [], nextCursor: null }
    }

    console.log(`[Phase 1 Query] Proceeding to query with authorizedTableIds:`, authorizedTableIds)
    // simulate getMultiTableRows call
    return { rows: [{ id: 1, tableId: authorizedTableIds[0], data: { mock: true } }], nextCursor: null }
}

async function run() {
    console.log("--- Simulating Scenario: User has access to Table 10, but NOT Table 11 ---")
    const mockAuthorize = async ({ tableId }: { tableId: number }) => {
        if (tableId === 11) {
            return { errorResponse: NextResponse.json({ error: 'Denied' }, { status: 403 }) }
        }
        return { errorResponse: undefined }
    }
    
    await simulateRouteTsLogic(1, [10, 11], mockAuthorize)
}

run()
