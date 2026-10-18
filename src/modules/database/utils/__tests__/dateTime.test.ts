import {
  resolveDateOptions,
  resolveTimeZone,
  normalizeDateInput,
  cellDayInZone,
  dayRangeUtc,
  toEditorValue,
  fromEditorValue,
  formatFieldDate,
} from '../dateTime'

const TPE = { date_include_time: true, date_time_zone: 'Asia/Taipei' }
const NY = { date_include_time: true, date_time_zone: 'America/New_York' }

describe('dateTime', () => {
  it('resolveDateOptions fills defaults and parses JSON strings', () => {
    expect(resolveDateOptions(null, 'date')).toEqual({ date_format: 'iso', date_include_time: false, date_time_format: '24', date_time_zone: 'client', date_show_time_zone: false })
    expect(resolveDateOptions(null, 'created_on').date_include_time).toBe(true)
    expect(resolveDateOptions('{"date_format":"us"}', 'date').date_format).toBe('us')
  })

  it('invalid time zone falls back to the viewer zone', () => {
    expect(resolveTimeZone(resolveDateOptions({ date_time_zone: 'Mars/Base' }), 'Asia/Taipei')).toBe('Asia/Taipei')
  })

  it.each([
    ['2026-10-18 14:30', TPE, '2026-10-18T06:30:00.000Z'],
    ['2026-10-18T14:30', TPE, '2026-10-18T06:30:00.000Z'],
    ['2026-10-18T14:30:00+08:00', NY, '2026-10-18T06:30:00.000Z'],
    ['2026-10-18', TPE, '2026-10-17T16:00:00.000Z'],
    ['2026-03-08 03:30', NY, '2026-03-08T07:30:00.000Z'],
    ['2026-11-01 01:30', NY, '2026-11-01T05:30:00.000Z'],
    ['2026-10-16T16:00:00.000Z', {}, '2026-10-16'],
    ['2026/1/5', {}, '2026-01-05'],
    ['', TPE, null],
    ['abc', TPE, null],
    ['2026-02-30 10:00', TPE, null],
  ])('normalizeDateInput(%j) -> %j', (input, opts, expected) => {
    expect(normalizeDateInput(input, opts)).toBe(expected)
  })

  it('client zone uses the viewer zone', () => {
    expect(normalizeDateInput('2026-10-18 14:30', { date_include_time: true }, 'Asia/Taipei')).toBe('2026-10-18T06:30:00.000Z')
  })

  it.each([
    ['2026-10-17T23:59:00.000Z', 'Asia/Taipei', '2026-10-18'],
    ['2026-10-17T15:59:00.000Z', 'Asia/Taipei', '2026-10-17'],
    ['2026-10-18', 'America/New_York', '2026-10-18'],
    ['garbage', 'Asia/Taipei', null],
  ])('cellDayInZone(%j, %s) -> %j', (v, tz, expected) => {
    expect(cellDayInZone(v, tz)).toBe(expected)
  })

  it('dayRangeUtc handles 25-hour DST day', () => {
    expect(dayRangeUtc('2026-11-01', 'America/New_York')).toEqual(['2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'])
    expect(dayRangeUtc('2026-10-18', 'Asia/Taipei')).toEqual(['2026-10-17T16:00:00.000Z', '2026-10-18T16:00:00.000Z'])
  })

  it('editor round trip', () => {
    expect(toEditorValue('2026-10-18T06:30:00.000Z', TPE)).toBe('2026-10-18T14:30')
    expect(fromEditorValue('2026-10-18T14:30', TPE)).toBe('2026-10-18T06:30:00.000Z')
    expect(toEditorValue('2026-10-18', TPE)).toBe('2026-10-18T00:00')
    expect(toEditorValue('2026-10-18T06:30:00.000Z', { date_time_zone: 'Asia/Taipei' })).toBe('2026-10-18')
    expect(fromEditorValue('', TPE)).toBeNull()
  })
})

describe('formatFieldDate', () => {
  const V = '2026-10-18T06:30:00.000Z'
  const base = { date_time_zone: 'Asia/Taipei' }
  it.each([
    [{ ...base }, 'zh-TW', '2026-10-18'],
    [{ ...base, date_format: 'us' }, 'zh-TW', '10/18/2026'],
    [{ ...base, date_format: 'european' }, 'zh-TW', '18/10/2026'],
    [{ ...base, date_format: 'local' }, 'zh-TW', '2026/10/18'],
    [{ ...base, date_format: 'friendly' }, 'zh-TW', '2026年10月18日'],
    [{ ...base, date_format: 'friendly' }, 'en', 'October 18, 2026'],
    [{ ...base, date_include_time: true }, 'zh-TW', '2026-10-18 14:30'],
    [{ ...base, date_include_time: true, date_time_format: '12' }, 'zh-TW', '2026-10-18 2:30 PM'],
    [{ ...base, date_include_time: true, date_format: 'us', date_show_time_zone: true }, 'en', '10/18/2026 14:30 GMT+8'],
    [{ ...base, date_show_time_zone: true }, 'zh-TW', '2026-10-18'],
  ])('formatFieldDate %j %s', (opts, locale, expected) => {
    expect(formatFieldDate(V, opts, { locale: locale as 'zh-TW' | 'en' })).toBe(expected)
  })
  it('legacy date-only value shown as midnight when time is on', () => {
    expect(formatFieldDate('2026-10-18', { ...base, date_include_time: true })).toBe('2026-10-18 00:00')
  })
  it('date-only value is not shifted by zone', () => {
    expect(formatFieldDate('2026-10-18', { date_time_zone: 'America/New_York' })).toBe('2026-10-18')
  })
  it('created_on defaults to showing time', () => {
    expect(formatFieldDate(V, { date_time_zone: 'Asia/Taipei' }, { fieldType: 'created_on' })).toBe('2026-10-18 14:30')
  })
  it('empty and unparseable values', () => {
    expect(formatFieldDate(null, base)).toBe('')
    expect(formatFieldDate('n/a', base)).toBe('n/a')
  })
})
