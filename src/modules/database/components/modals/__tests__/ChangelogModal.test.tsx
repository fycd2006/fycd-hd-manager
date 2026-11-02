/** @jest-environment jsdom */
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChangelogModal } from '../ChangelogModal'
import type { VersionRelease } from '@/config/changelog'

const mockHistory: VersionRelease[] = [
  {
    version: 'v1.1.0',
    releaseDate: '2026-11-02',
    title: '版本紀錄系統',
    isLatest: true,
    items: [
      { type: 'feature', text: '新增版本更新紀錄視窗' },
      { type: 'improvement', text: '輕量自動檢測' },
    ],
  },
  {
    version: 'v1.0.0',
    releaseDate: '2026-10-18',
    title: '正式版發布',
    items: [{ type: 'fix', text: '修復關聯儲存格問題' }],
  },
]

describe('ChangelogModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <ChangelogModal
        open={false}
        onClose={jest.fn()}
        currentVersion="v1.1.0"
        changelog={mockHistory}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal content with releases and categories when open is true', () => {
    render(
      <ChangelogModal
        open={true}
        onClose={jest.fn()}
        currentVersion="v1.1.0"
        changelog={mockHistory}
      />
    )

    expect(screen.getByText('版本更新紀錄')).toBeInTheDocument()
    expect(screen.getByText('版本紀錄系統')).toBeInTheDocument()
    expect(screen.getByText('新增版本更新紀錄視窗')).toBeInTheDocument()
    expect(screen.getByText('輕量自動檢測')).toBeInTheDocument()
    expect(screen.getByText('正式版發布')).toBeInTheDocument()
    expect(screen.getByText('修復關聯儲存格問題')).toBeInTheDocument()
  })

  it('displays update banner and triggers onUpdate when hasUpdate is true', () => {
    const handleUpdate = jest.fn()
    render(
      <ChangelogModal
        open={true}
        onClose={jest.fn()}
        currentVersion="v1.1.0"
        latestVersion="v1.2.0"
        hasUpdate={true}
        onUpdate={handleUpdate}
        changelog={mockHistory}
      />
    )

    expect(screen.getByText(/發現新版本 v1.2.0/)).toBeInTheDocument()
    const updateBtn = screen.getByRole('button', { name: /立即更新/i })
    expect(updateBtn).toBeInTheDocument()

    fireEvent.click(updateBtn)
    expect(handleUpdate).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn()
    render(
      <ChangelogModal
        open={true}
        onClose={handleClose}
        currentVersion="v1.1.0"
        changelog={mockHistory}
      />
    )

    const closeBtn = screen.getByRole('button', { name: /關閉/i })
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
