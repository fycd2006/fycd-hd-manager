/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import { DateFieldOptions } from '../field-options/DateFieldOptions'
import { CreateFieldPopover } from '../../field/CreateFieldPopover'
import { resolveDateOptions } from '@/modules/database/utils/dateTime'

function setup(value = resolveDateOptions(null, 'date'), fieldType = 'date') {
  const onChange = jest.fn()
  render(
    <I18nProvider>
      <DateFieldOptions value={value} onChange={onChange} fieldType={fieldType} />
    </I18nProvider>
  )
  return onChange
}

describe('DateFieldOptions', () => {
  beforeAll(() => {
    document.cookie = 'i18n_locale=zh-TW'
  })
  afterAll(() => {
    document.cookie = 'i18n_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('hides time controls when include time is off', () => {
    setup()
    expect(screen.getByRole('combobox', { name: '日期格式' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '時間格式' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '時區' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('顯示時區標籤')).not.toBeInTheDocument()
  })

  it('emits date_include_time true when the checkbox is ticked', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText('含時間'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date_include_time: true }))
  })

  it('offers the five date formats', () => {
    setup()
    const select = screen.getByRole('combobox', { name: '日期格式' })
    const labels = Array.from(select.querySelectorAll('option')).map(o => o.textContent)
    expect(labels).toEqual(['本地', '易讀', '美式', '歐式', 'ISO'])
  })

  it('shows time controls with client zone first when include time is on', () => {
    setup(resolveDateOptions({ date_include_time: true }, 'date'))
    expect(screen.getByRole('combobox', { name: '時間格式' })).toBeInTheDocument()
    expect(screen.getByLabelText('顯示時區標籤')).toBeInTheDocument()
    const zone = screen.getByRole('combobox', { name: '時區' }) as HTMLSelectElement
    const options = Array.from(zone.querySelectorAll('option'))
    expect(options[0].value).toBe('client')
    expect(options[0].textContent).toBe('依瀏覽器時區')
    const values = options.map(o => o.value)
    expect(values).toContain('Asia/Taipei')
    expect(values).toContain('UTC')
  })

  it('emits the chosen time zone', () => {
    const onChange = setup(resolveDateOptions({ date_include_time: true }, 'date'))
    fireEvent.change(screen.getByRole('combobox', { name: '時區' }), { target: { value: 'Asia/Taipei' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date_time_zone: 'Asia/Taipei' }))
  })

  it('submits include-time true by default for a new created_on field', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    const { container } = render(
      <I18nProvider>
        <CreateFieldPopover show onClose={() => {}} onSubmit={onSubmit} position={{ top: 0, left: 0 }} defaultType="created_on" />
      </I18nProvider>
    )
    expect(screen.getByLabelText('含時間')).toBeChecked()
    fireEvent.submit(container.ownerDocument.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][1]).toBe('created_on')
    expect(onSubmit.mock.calls[0][2]).toEqual(expect.objectContaining({ date_include_time: true }))
  })
})
