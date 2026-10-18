/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useThemeStore } from '../useThemeStore'

jest.mock('darkreader', () => ({
  enable: jest.fn(),
  disable: jest.fn(),
  setFetchMethod: jest.fn(),
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
})

describe('useThemeStore', () => {
  afterEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it('does not flash data-theme to light on mount when the saved preference is dark', async () => {
    localStorage.setItem('theme_preference', 'dark')
    // layout.tsx 的行內腳本在首次繪製前已設好
    document.documentElement.setAttribute('data-theme', 'dark')
    const setAttribute = jest.spyOn(document.documentElement, 'setAttribute')

    const { result } = renderHook(() => useThemeStore())

    await waitFor(() => expect(result.current[0].theme).toBe('dark'))
    expect(setAttribute).not.toHaveBeenCalledWith('data-theme', 'light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
