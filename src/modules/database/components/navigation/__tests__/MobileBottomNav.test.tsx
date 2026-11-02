/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import MobileBottomNav from '../MobileBottomNav'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import type { Workspace, User } from '@/modules/database/types'

jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: function (_target, prop) {
      if (prop === '__esModule') return false
      return () => <span data-testid={`icon-${String(prop)}`} />
    }
  })
})

jest.mock('@/components/animate-ui/primitives/texts/sliding-number', () => ({
  SlidingNumber: ({ number }: { number: number }) => <span>{number}</span>,
}))

jest.mock('../MobileSearchModal', () => () => null)
jest.mock('@/components/ui/BottomSheet', () => () => null)

const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'member',
}

const mockWorkspaces: Workspace[] = [
  {
    id: 1,
    name: 'Workspace 1',
    databases: [],
  },
]

describe('MobileBottomNav — update notification dot', () => {
  it('renders update indicator on settings in bubble menu and triggers onShowUserSettingsModal', () => {
    const handleShowUserSettings = jest.fn()

    const { rerender } = render(
      <I18nProvider>
        <MobileBottomNav
          workspaces={mockWorkspaces}
          activeWorkspaceId={1}
          activeTableId={null}
          currentUser={mockUser}
          onSelectDashboard={jest.fn()}
          onSetActiveWorkspaceId={jest.fn()}
          onSetActiveTableId={jest.fn()}
          onShowNotificationsModal={jest.fn()}
          onShowUserSettingsModal={handleShowUserSettings}
          hasUpdate={true}
        />
      </I18nProvider>
    )

    // Settings item in bubble menu
    const settingsItem = screen.getByTitle('Settings')
    expect(settingsItem).toBeInTheDocument()

    // Has update dot (orange background)
    const updateDot = settingsItem.querySelector('span[style*="var(--brand-orange-main)"]')
    expect(updateDot).not.toBeNull()

    // Click settings item
    fireEvent.click(settingsItem)
    expect(handleShowUserSettings).toHaveBeenCalledTimes(1)

    // When hasUpdate is false, update dot should not exist
    rerender(
      <I18nProvider>
        <MobileBottomNav
          workspaces={mockWorkspaces}
          activeWorkspaceId={1}
          activeTableId={null}
          currentUser={mockUser}
          onSelectDashboard={jest.fn()}
          onSetActiveWorkspaceId={jest.fn()}
          onSetActiveTableId={jest.fn()}
          onShowNotificationsModal={jest.fn()}
          onShowUserSettingsModal={handleShowUserSettings}
          hasUpdate={false}
        />
      </I18nProvider>
    )

    const updatedSettingsItem = screen.getByTitle('Settings')
    const noUpdateDot = updatedSettingsItem.querySelector('span[style*="var(--brand-orange-main)"]')
    expect(noUpdateDot).toBeNull()
  })
})
