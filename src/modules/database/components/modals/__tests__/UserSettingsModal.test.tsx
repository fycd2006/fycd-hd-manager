/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import UserSettingsModal from '../UserSettingsModal'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import type { User } from '@/modules/database/types'

const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'member',
}

describe('UserSettingsModal — mobile changelog entry', () => {
  it('renders version info and triggers onShowChangelogModal when clicked', () => {
    const handleShowChangelog = jest.fn()
    const handleClose = jest.fn()

    render(
      <I18nProvider>
        <UserSettingsModal
          show={true}
          onClose={handleClose}
          currentUser={mockUser}
          onToast={jest.fn()}
          currentVersion="v1.1.0"
          hasUpdate={true}
          onShowChangelogModal={handleShowChangelog}
        />
      </I18nProvider>
    )

    expect(screen.getByText('版本紀錄與更新')).toBeInTheDocument()
    expect(screen.getByText(/目前版本：v1.1.0/)).toBeInTheDocument()
    expect(screen.getByText('NEW')).toBeInTheDocument()

    const versionBtn = screen.getByText('版本紀錄與更新').closest('button')
    expect(versionBtn).not.toBeNull()
    fireEvent.click(versionBtn!)

    expect(handleClose).toHaveBeenCalled()
    expect(handleShowChangelog).toHaveBeenCalled()
  })
})
