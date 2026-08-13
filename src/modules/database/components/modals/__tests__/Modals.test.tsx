/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { WorkspaceModal, DatabaseModal, RenameModal, ViewModal, FieldModal, TableModal } from '../Modals'
import { I18nProvider } from '@/lib/i18n/i18nContext'

// Mock Lucide icons to prevent SVG rendering issues in JSDOM
jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'useIcon') return () => null;
      return () => <span data-testid={`icon-${String(prop)}`} />
    }
  });
})

// Mock Modal since it uses portals which might be tricky in simple JSDOM setup without a root element
jest.mock('@/components/ui/Modal', () => {
  return function MockModal({ children, title, show }: any) {
    if (!show) return null
    return (
      <div data-testid="mock-modal">
        <h2>{title}</h2>
        {children}
      </div>
    )
  }
})

describe('WorkspaceModal', () => {
  it('renders correctly when show is true', () => {
    render(
      <I18nProvider>
        <WorkspaceModal show={true} onClose={() => {}} onSubmit={async () => {}} />
      </I18nProvider>
    )

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Marketing, Product Team|modals\.workspacePlaceholder|例如：主要清單/i)).toBeInTheDocument()
  })

  it('does not render when show is false', () => {
    render(
      <I18nProvider>
        <WorkspaceModal show={false} onClose={() => {}} onSubmit={async () => {}} />
      </I18nProvider>
    )

    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument()
  })
})

describe('DatabaseModal', () => {
  it('renders correctly', () => {
    render(
      <I18nProvider>
        <DatabaseModal show={true} onClose={() => {}} onSubmit={async () => {}} onOpenAirtableImport={() => {}} />
      </I18nProvider>
    )
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
  })
})

describe('RenameModal', () => {
  it('renders correctly', () => {
    render(
      <I18nProvider>
        <RenameModal show={true} type="workspace" initialValue="Old Name" onClose={() => {}} onSubmit={async () => {}} />
      </I18nProvider>
    )
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
  })
})

describe('ViewModal', () => {
  it('renders correctly', () => {
    render(
      <I18nProvider>
        <ViewModal show={true} onClose={() => {}} onSubmit={async () => {}} />
      </I18nProvider>
    )
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
  })
})

describe('FieldModal', () => {
  it('renders correctly', () => {
    render(
      <I18nProvider>
        <FieldModal show={true} onClose={() => {}} onSubmit={async () => {}} />
      </I18nProvider>
    )
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
  })
})

describe('TableModal', () => {
  it('renders correctly', () => {
    render(
      <I18nProvider>
        <TableModal show={true} onClose={() => {}} onSubmit={async () => {}} />
      </I18nProvider>
    )
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
  })
})
