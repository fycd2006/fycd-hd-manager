/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import AuthScreen from '../AuthScreen'

jest.mock('@/lib/i18n/i18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-TW' }),
}))

jest.mock('@/modules/database/components/navigation/LangPicker', () => ({
  LangPicker: () => null,
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
})

type Props = React.ComponentProps<typeof AuthScreen>

const baseProps = (overrides: Partial<Props> = {}): Props => ({
  authMode: 'login',
  authUsername: 'alice',
  authEmail: '',
  authPassword: 'secret',
  onAuthModeChange: jest.fn(),
  onAuthUsernameChange: jest.fn(),
  onAuthEmailChange: jest.fn(),
  onAuthPasswordChange: jest.fn(),
  onLogin: jest.fn().mockResolvedValue(undefined),
  onRegister: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

const submitForm = (container: HTMLElement) => {
  fireEvent.submit(container.querySelector('form')!)
}

describe('AuthScreen', () => {
  it('shows the brand logo', () => {
    render(<AuthScreen {...baseProps()} />)
    expect(screen.getByRole('img', { name: 'FYCD HD' })).toBeInTheDocument()
  })

  it('switches to register via the mode link', () => {
    const props = baseProps()
    render(<AuthScreen {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'auth.registerNow' }))
    expect(props.onAuthModeChange).toHaveBeenCalledWith('register')
  })

  it('reset-password validation still blocks mismatched passwords', async () => {
    const onResetPassword = jest.fn()
    const { container } = render(
      <AuthScreen {...baseProps({ authMode: 'reset-password', onResetPassword })} />
    )
    fireEvent.change(screen.getByPlaceholderText('auth.enterNewPassword'), { target: { value: 'Abcdefg1' } })
    fireEvent.change(screen.getByPlaceholderText('auth.enterConfirmPassword'), { target: { value: 'Abcdefg2' } })
    await act(async () => {
      submitForm(container)
    })
    expect(await screen.findByText('auth.passwordMismatch')).toBeInTheDocument()
    expect(onResetPassword).not.toHaveBeenCalled()
  })

  it('primary button is aria-busy while submitting', async () => {
    const onLogin = jest.fn(() => new Promise<void>(() => {}))
    const { container } = render(<AuthScreen {...baseProps({ onLogin })} />)
    await act(async () => {
      submitForm(container)
    })
    expect(container.querySelector('button[type="submit"]')).toHaveAttribute('aria-busy', 'true')
  })

  it('does not submit again while leaving', async () => {
    const onLogin = jest.fn().mockResolvedValue(undefined)
    const { container } = render(<AuthScreen {...baseProps({ onLogin, leaving: true })} />)
    await act(async () => {
      submitForm(container)
    })
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('clicking the password label does not trigger forgot-password', () => {
    const props = baseProps()
    render(<AuthScreen {...props} />)
    fireEvent.click(screen.getByText('auth.passwordLabel'))
    expect(props.onAuthModeChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('auth.passwordLabel')).toHaveAttribute('type', 'password')
  })

  it('error message is announced', () => {
    render(<AuthScreen {...baseProps({ errorMessage: '登入失敗' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('登入失敗')
  })
})
