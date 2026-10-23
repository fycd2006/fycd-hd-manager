/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useHoverPrefetch } from '../useHoverPrefetch'

// jsdom 沒有 PointerEvent，補一個會帶 pointerType 的最小版本
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? ''
    }
  }
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill
}

function Harness({ onPrefetch }: { onPrefetch?: (id: number) => void }) {
  const getHandlers = useHoverPrefetch(onPrefetch)
  return <button data-testid="b" {...getHandlers(7)} />
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('useHoverPrefetch', () => {
  it('fires after 120ms hover', () => {
    const onPrefetch = jest.fn()
    render(<Harness onPrefetch={onPrefetch} />)
    fireEvent.pointerEnter(screen.getByTestId('b'), { pointerType: 'mouse' })
    act(() => { jest.advanceTimersByTime(119) })
    expect(onPrefetch).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1) })
    expect(onPrefetch).toHaveBeenCalledTimes(1)
    expect(onPrefetch).toHaveBeenCalledWith(7)
  })

  it('cancels when leaving early', () => {
    const onPrefetch = jest.fn()
    render(<Harness onPrefetch={onPrefetch} />)
    const el = screen.getByTestId('b')
    fireEvent.pointerEnter(el, { pointerType: 'mouse' })
    act(() => { jest.advanceTimersByTime(100) })
    fireEvent.pointerLeave(el, { pointerType: 'mouse' })
    act(() => { jest.advanceTimersByTime(100) })
    expect(onPrefetch).not.toHaveBeenCalled()
  })

  it('fires immediately on touch pointerdown', () => {
    const onPrefetch = jest.fn()
    render(<Harness onPrefetch={onPrefetch} />)
    fireEvent.pointerDown(screen.getByTestId('b'), { pointerType: 'touch' })
    expect(onPrefetch).toHaveBeenCalledWith(7)
  })

  it('ignores mouse pointerdown', () => {
    const onPrefetch = jest.fn()
    render(<Harness onPrefetch={onPrefetch} />)
    fireEvent.pointerDown(screen.getByTestId('b'), { pointerType: 'mouse' })
    expect(onPrefetch).not.toHaveBeenCalled()
  })

  it('clears timer on unmount', () => {
    const onPrefetch = jest.fn()
    const { unmount } = render(<Harness onPrefetch={onPrefetch} />)
    fireEvent.pointerEnter(screen.getByTestId('b'), { pointerType: 'mouse' })
    unmount()
    act(() => { jest.advanceTimersByTime(200) })
    expect(onPrefetch).not.toHaveBeenCalled()
  })
})
