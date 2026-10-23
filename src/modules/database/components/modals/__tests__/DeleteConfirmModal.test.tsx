/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DeleteConfirmModal } from '../DeleteConfirmModal'
import { I18nProvider } from '@/lib/i18n/i18nContext'

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_t, prop) => () => <span data-testid={`icon-${String(prop)}`} />,
}))

jest.mock('@/components/ui/Modal', () => {
  return function MockModal({ children, title, show, onClose }: { children: React.ReactNode; title?: string; show: boolean; onClose: () => void }) {
    if (!show) return null
    return (
      <div data-testid="mock-modal" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <h2>{title}</h2>
        {children}
      </div>
    )
  }
})

const setup = (overrides = {}) => {
  const onConfirm = jest.fn()
  const onClose = jest.fn()
  render(
    <I18nProvider>
      <DeleteConfirmModal open kind="workspace" name="伙食團" onConfirm={onConfirm} onClose={onClose} {...overrides} />
    </I18nProvider>
  )
  const input = screen.getByRole('textbox')
  const deleteBtn = screen.getByRole('button', { name: /刪除|Delete/ })
  return { onConfirm, onClose, input, deleteBtn }
}

describe('DeleteConfirmModal', () => {
  it('keeps the delete button disabled until the exact name is typed', () => {
    const { input, deleteBtn } = setup()
    expect(deleteBtn).toBeDisabled()
    fireEvent.change(input, { target: { value: '伙食' } })
    expect(deleteBtn).toBeDisabled()
    fireEvent.change(input, { target: { value: ' 伙食團 ' } })
    expect(deleteBtn).toBeDisabled()
    fireEvent.change(input, { target: { value: '伙食團' } })
    expect(deleteBtn).toBeEnabled()
  })

  it('calls onConfirm once when confirmed', async () => {
    const { input, deleteBtn, onConfirm } = setup()
    fireEvent.change(input, { target: { value: '伙食團' } })
    fireEvent.click(deleteBtn)
    fireEvent.click(deleteBtn)
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })

  it('does not confirm on Enter when the name does not match', () => {
    const { input, onConfirm } = setup()
    fireEvent.submit(input.closest('form')!)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onClose on Escape and on cancel', () => {
    const { onClose } = setup()
    fireEvent.keyDown(screen.getByTestId('mock-modal'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /取消|Cancel/ }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
