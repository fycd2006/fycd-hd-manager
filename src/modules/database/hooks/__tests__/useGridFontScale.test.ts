/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useGridFontScale, GRID_FONT_SCALE_KEY } from '../useGridFontScale'

describe('useGridFontScale', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it('defaults to standard when no value is stored', () => {
    const { result } = renderHook(() => useGridFontScale())
    expect(result.current[0]).toBe('standard')
  })

  it('reads pre-stored valid font scale "large"', () => {
    localStorage.setItem(GRID_FONT_SCALE_KEY, 'large')
    const { result } = renderHook(() => useGridFontScale())
    expect(result.current[0]).toBe('large')
  })

  it('falls back to standard when pre-stored value is invalid "huge"', () => {
    localStorage.setItem(GRID_FONT_SCALE_KEY, 'huge')
    const { result } = renderHook(() => useGridFontScale())
    expect(result.current[0]).toBe('standard')
  })

  it('updates state and persists to localStorage on set', () => {
    const { result } = renderHook(() => useGridFontScale())
    expect(result.current[0]).toBe('standard')

    act(() => {
      result.current[1]('xlarge')
    })

    expect(result.current[0]).toBe('xlarge')
    expect(localStorage.getItem(GRID_FONT_SCALE_KEY)).toBe('xlarge')
  })

  it('does not throw when localStorage.getItem throws and returns standard', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied')
    })

    const { result } = renderHook(() => useGridFontScale())
    expect(result.current[0]).toBe('standard')
  })

  it('does not throw when localStorage.setItem throws and still updates state', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })

    const { result } = renderHook(() => useGridFontScale())
    act(() => {
      result.current[1]('large')
    })

    expect(result.current[0]).toBe('large')
  })
})
