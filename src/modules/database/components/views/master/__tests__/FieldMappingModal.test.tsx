/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FieldMappingModal } from '../FieldMappingModal'


describe('FieldMappingModal UI Component', () => {
  const mockFieldsMap = {
    field_1: { id: 1, tableId: 1, name: '客戶名稱', type: 'text' },
    field_2: { id: 2, tableId: 2, name: '客戶名稱', type: 'text' },
    field_3: { id: 3, tableId: 1, name: '聯絡人', type: 'text' },
    field_4: { id: 4, tableId: 2, name: '聯絡窗口', type: 'text' },
  }

  const mockTablesMap = {
    1: { name: '台灣訂單' },
    2: { name: '海外訂單' },
  }

  it('synchronizes internal state when initialUnmergedKeys or initialCustomAliasMap props change', () => {
    const handleApplyMapping = jest.fn()
    const handleClose = jest.fn()

    const { rerender } = render(
      <FieldMappingModal
        show={true}
        onClose={handleClose}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={[]}
        customAliasMap={{}}
        onApplyMapping={handleApplyMapping}
      />
    )

    // Initially, 客戶名稱 is merged across 2 tables
    expect(screen.getByText('已合併之統一欄位 (1)')).toBeInTheDocument()

    // Rerender with initialUnmergedKeys containing '客戶名稱'
    rerender(
      <FieldMappingModal
        show={true}
        onClose={handleClose}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={['客戶名稱']}
        customAliasMap={{}}
        onApplyMapping={handleApplyMapping}
      />
    )

    // Now merged columns should be 0 because 客戶名稱 was unmerged
    expect(screen.getByText('目前無跨表合併欄位（所有子表欄位均為獨立顯示）')).toBeInTheDocument()
  })


  it('allows configuring synonym alias mapping and applying changes', () => {
    const handleApplyMapping = jest.fn()
    const handleClose = jest.fn()

    render(
      <FieldMappingModal
        show={true}
        onClose={handleClose}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={[]}
        customAliasMap={{}}
        onApplyMapping={handleApplyMapping}
      />
    )

    // Find the merge select for field_4 (聯絡窗口) and map it to 聯絡人
    const select = screen.getByTestId('merge-select-field_4')
    fireEvent.change(select, { target: { value: '聯絡人' } })

    // Click Apply button
    const applyBtn = screen.getByTestId('apply-mapping-btn')
    fireEvent.click(applyBtn)

    expect(handleApplyMapping).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ field_4: '聯絡人' })
    )
    expect(handleClose).toHaveBeenCalled()
  })

  it('resets mapping to auto when reset button is clicked', () => {
    const handleApplyMapping = jest.fn()
    const handleClose = jest.fn()

    render(
      <FieldMappingModal
        show={true}
        onClose={handleClose}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={['客戶名稱']}
        customAliasMap={{ field_4: '聯絡人' }}
        onApplyMapping={handleApplyMapping}
      />
    )

    const resetBtn = screen.getByTestId('reset-mapping-auto-btn')
    fireEvent.click(resetBtn)

    const applyBtn = screen.getByTestId('apply-mapping-btn')
    fireEvent.click(applyBtn)

    expect(handleApplyMapping).toHaveBeenCalledWith([], {})
  })

  it('allows adding a custom new target column name and merging into it', () => {
    const handleApplyMapping = jest.fn()
    const handleClose = jest.fn()

    render(
      <FieldMappingModal
        show={true}
        onClose={handleClose}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={[]}
        customAliasMap={{}}
        onApplyMapping={handleApplyMapping}
      />
    )

    const input = screen.getByTestId('new-custom-target-input')
    fireEvent.change(input, { target: { value: '統編 / 稅號' } })

    const addBtn = screen.getByTestId('add-custom-target-btn')
    fireEvent.click(addBtn)

    // Now '統編 / 稅號' should appear in the select options
    const select = screen.getByTestId('merge-select-field_4')
    expect(screen.getAllByText('歸併至「統編 / 稅號」').length).toBeGreaterThan(0)

    fireEvent.change(select, { target: { value: '統編 / 稅號' } })

    const applyBtn = screen.getByTestId('apply-mapping-btn')
    fireEvent.click(applyBtn)

    expect(handleApplyMapping).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ field_4: '統編 / 稅號' })
    )
  })

  it('disables target options that would cause same-table field collisions', () => {
    render(
      <FieldMappingModal
        show={true}
        onClose={jest.fn()}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={[]}
        customAliasMap={{}}
        onApplyMapping={jest.fn()}
      />
    )

    // For field_3 (Table 1 聯絡人), '客戶名稱' is already occupied by field_1 (Table 1 客戶名稱)
    // So '歸併至「客戶名稱」' should be disabled for field_3
    const field3Select = screen.getByTestId('merge-select-field_3')
    const options = Array.from(field3Select.querySelectorAll('option'))
    const collisionOption = options.find((opt) => opt.value === '客戶名稱')

    expect(collisionOption).toBeDefined()
    expect(collisionOption).toBeDisabled()
    expect(collisionOption?.textContent).toContain('(同表已佔用)')
  })

  it('displays restore auto-merge button for unmerged fields and allows restoring merge', () => {
    const handleApplyMapping = jest.fn()

    render(
      <FieldMappingModal
        show={true}
        onClose={jest.fn()}
        fieldsMap={mockFieldsMap}
        tablesMap={mockTablesMap}
        unmergedKeys={['客戶名稱']}
        customAliasMap={{}}
        onApplyMapping={handleApplyMapping}
      />
    )

    // With '客戶名稱' unmerged, both field_1 and field_2 show the restore button in independent fields
    const restoreBtn = screen.getByTestId('restore-automerge-field_1')
    expect(restoreBtn).toBeInTheDocument()

    // Click restore auto merge
    fireEvent.click(restoreBtn)

    // Now 客戶名稱 should be back in merged columns on the left
    expect(screen.getByText('已合併之統一欄位 (1)')).toBeInTheDocument()
    expect(screen.getByText('客戶名稱')).toBeInTheDocument()
  })
})


