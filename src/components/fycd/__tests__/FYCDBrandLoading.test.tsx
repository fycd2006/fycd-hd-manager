/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FYCDBrandLoading } from '../FYCDBrandLoading'

const mockMatchMedia = (reduced: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: reduced,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
}

describe('FYCDBrandLoading', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    sessionStorage.clear()
    mockMatchMedia(false)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the vector logo without the skip hint or external svg', () => {
    const { container } = render(<FYCDBrandLoading show workspaceReady={false} />)
    expect(screen.getByRole('img', { name: 'FYCD HD' })).toBeInTheDocument()
    expect(screen.queryByText(/按 Esc/)).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('calls onEntered once after the enter transition', () => {
    const onEntered = jest.fn()
    const { rerender } = render(<FYCDBrandLoading show workspaceReady={false} onEntered={onEntered} />)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(onEntered).toHaveBeenCalledTimes(1)
    rerender(<FYCDBrandLoading show workspaceReady={false} onEntered={onEntered} />)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(onEntered).toHaveBeenCalledTimes(1)
  })

  it('calls onEntered on reduced motion', () => {
    mockMatchMedia(true)
    const onEntered = jest.fn()
    render(<FYCDBrandLoading show workspaceReady={false} onEntered={onEntered} />)
    expect(onEntered).toHaveBeenCalledTimes(1)
  })

  it('calls onEntered before onExitComplete when already shown this session', () => {
    sessionStorage.setItem('fycd_brand_loading_shown', 'true')
    const onEntered = jest.fn()
    const onExitComplete = jest.fn()
    render(
      <FYCDBrandLoading show workspaceReady={false} onEntered={onEntered} onExitComplete={onExitComplete} />
    )
    expect(onEntered).toHaveBeenCalledTimes(1)
    expect(onExitComplete).toHaveBeenCalledTimes(1)
    expect(onEntered.mock.invocationCallOrder[0]).toBeLessThan(onExitComplete.mock.invocationCallOrder[0])
  })

  it('waits for the logo animation before exiting when workspace is already ready', () => {
    const onExitComplete = jest.fn()
    render(<FYCDBrandLoading show workspaceReady onExitComplete={onExitComplete} />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onExitComplete).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onExitComplete).toHaveBeenCalledTimes(1)
  })

  it('replay ignores the session flag and still covers the screen', () => {
    sessionStorage.setItem('fycd_brand_loading_shown', 'true')
    const onExitComplete = jest.fn()
    render(<FYCDBrandLoading show replay workspaceReady={false} onExitComplete={onExitComplete} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(onExitComplete).not.toHaveBeenCalled()
  })

  it('Escape skips and completes', () => {
    const onExitComplete = jest.fn()
    render(<FYCDBrandLoading show workspaceReady={false} onExitComplete={onExitComplete} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(onExitComplete).toHaveBeenCalledTimes(1)
  })
})
