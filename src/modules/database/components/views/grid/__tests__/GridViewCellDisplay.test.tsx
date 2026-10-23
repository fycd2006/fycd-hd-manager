/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GridViewCell } from '../GridViewCell'
import type { TableField } from '@/modules/database/types'

describe('GridViewCellDisplay - Shared Grid Classes & Density', () => {
  const baseField: TableField = {
    id: 1,
    tableId: 10,
    name: 'Test Field',
    type: 'text',
    order: 0,
    options: null,
    width: 200,
  }

  const baseProps = {
    rowId: 101,
    isSelected: false,
    isEditing: false,
    onSelect: jest.fn(),
    onStartEdit: jest.fn(),
    onUpdate: jest.fn(),
    onCancelEdit: jest.fn(),
  }

  describe('Text field types', () => {
    const textTypes = [
      { type: 'text', value: 'Hello world' },
      { type: 'long_text', value: 'Long paragraph text' },
      { type: 'url', value: 'https://example.com' },
      { type: 'email', value: 'test@example.com' },
      { type: 'phone', value: '0912345678' },
      { type: 'date', value: '2026-10-23' },
      { type: 'lookup', value: 'Lookup result' },
    ]

    test.each(textTypes)('type "$type" renders with grid-cell-text and outer grid-cell--wrap', ({ type, value }) => {
      const field = { ...baseField, type }
      const { container } = render(<GridViewCell {...baseProps} field={field} value={value} />)

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).toHaveClass('grid-view__column')
      expect(outerDiv).toHaveClass('grid-cell--wrap')

      const textElement = container.querySelector('.grid-cell-text') as HTMLElement
      expect(textElement).toBeInTheDocument()
      expect(textElement.style.fontSize).toBe('')
      expect(textElement.style.whiteSpace).toBe('')
    })
  })

  describe('Tag field types', () => {
    it('single_select / multiple_select render grid-cell-tags, grid-cell-tag, and grid-cell--wrap', () => {
      const field: TableField = {
        ...baseField,
        type: 'multiple_select',
        options: JSON.stringify({ choices: [{ id: '1', name: 'TagA', color: 'blue' }] }),
      }
      const { container } = render(<GridViewCell {...baseProps} field={field} value={['TagA']} />)

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).toHaveClass('grid-cell--wrap')

      const tagsContainer = container.querySelector('.grid-cell-tags') as HTMLElement
      expect(tagsContainer).toBeInTheDocument()
      expect(tagsContainer.style.flexWrap).toBe('')

      const tagPill = container.querySelector('.grid-cell-tag') as HTMLElement
      expect(tagPill).toBeInTheDocument()
    })

    it('collaborator renders grid-cell-tags, grid-cell-tag, and grid-cell--wrap', () => {
      const field: TableField = { ...baseField, type: 'collaborator' }
      const { container } = render(
        <GridViewCell {...baseProps} field={field} value={[{ id: 1, username: 'Alice' }]} />
      )

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).toHaveClass('grid-cell--wrap')

      const tagsContainer = container.querySelector('.grid-cell-tags') as HTMLElement
      expect(tagsContainer).toBeInTheDocument()
      expect(tagsContainer.style.flexWrap).toBe('')

      const tagPill = container.querySelector('.grid-cell-tag') as HTMLElement
      expect(tagPill).toBeInTheDocument()
    })

    it('link_row renders grid-cell-tags and grid-cell--wrap', () => {
      const field: TableField = { ...baseField, type: 'link_row' }
      const { container } = render(
        <GridViewCell {...baseProps} field={field} value={[{ id: 99, value: 'Row 99' }]} />
      )

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).toHaveClass('grid-cell--wrap')

      const tagsContainer = container.querySelector('.grid-cell-tags') as HTMLElement
      expect(tagsContainer).toBeInTheDocument()
      expect(tagsContainer.style.flexWrap).toBe('')
    })
  })

  describe('Numeric and Non-wrap field types', () => {
    it('number renders grid-cell-numeric without monospace fontFamily or grid-cell--wrap', () => {
      const field: TableField = { ...baseField, type: 'number' }
      const { container } = render(<GridViewCell {...baseProps} field={field} value={12345} />)

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).not.toHaveClass('grid-cell--wrap')

      const numElement = container.querySelector('.grid-cell-numeric') as HTMLElement
      expect(numElement).toBeInTheDocument()
      expect(numElement.style.fontFamily).toBe('')
    })

    it('autonumber renders grid-cell-numeric without monospace fontFamily or grid-cell--wrap', () => {
      const field: TableField = { ...baseField, type: 'autonumber' }
      const { container } = render(<GridViewCell {...baseProps} field={field} value={42} />)

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).not.toHaveClass('grid-cell--wrap')

      const numElement = container.querySelector('.grid-cell-numeric') as HTMLElement
      expect(numElement).toBeInTheDocument()
      expect(numElement.style.fontFamily).toBe('')
    })

    it('boolean does not have grid-cell--wrap', () => {
      const field: TableField = { ...baseField, type: 'boolean' }
      const { container } = render(<GridViewCell {...baseProps} field={field} value={true} />)

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).not.toHaveClass('grid-cell--wrap')
    })

    it('rating does not have grid-cell--wrap', () => {
      const field: TableField = { ...baseField, type: 'rating' }
      const { container } = render(<GridViewCell {...baseProps} field={field} value={3} />)

      const outerDiv = container.firstElementChild as HTMLElement
      expect(outerDiv).not.toHaveClass('grid-cell--wrap')
    })
  })
})
