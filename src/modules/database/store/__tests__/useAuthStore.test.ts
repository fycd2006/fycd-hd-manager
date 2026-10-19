/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '../useAuthStore'
import * as authService from '../../services/auth'
import { tableDataCache, __resetTableDataCacheForTests } from '../../cache/tableDataCache'

jest.mock('../../services/auth', () => ({
  logout: jest.fn(),
}))

describe('useAuthStore', () => {
  afterEach(() => {
    __resetTableDataCacheForTests()
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('logout clears table data cache', async () => {
    ;(authService.logout as jest.Mock).mockResolvedValue(undefined)
    tableDataCache.set(1, { fields: [], rows: [], views: [], fetchedAt: Date.now() })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current[1].logout()
    })

    expect(authService.logout).toHaveBeenCalled()
    expect(tableDataCache.get(1)).toBeUndefined()
  })
})
