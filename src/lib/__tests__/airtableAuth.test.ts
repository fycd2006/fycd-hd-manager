import { extractAirtableId } from '../airtable/auth'
import { extractShareIdFromUrl } from '../airtable/airtableScraper'

describe('extractAirtableId', () => {
  it('extracts base ID from direct input', () => {
    const result = extractAirtableId('appq84gZBqhGv0fWl')
    expect(result).toEqual({ type: 'base', id: 'appq84gZBqhGv0fWl' })
  })

  it('extracts share ID from direct input', () => {
    const result = extractAirtableId('shrsPxTefOkvQAWRs')
    expect(result).toEqual({ type: 'share', id: 'shrsPxTefOkvQAWRs' })
  })

  it('prioritizes base ID over share ID in URL with both', () => {
    const result = extractAirtableId('https://airtable.com/appq84gZBqhGv0fWl/shrsPxTefOkvQAWRs')
    expect(result.type).toBe('base')
    expect(result.id).toBe('appq84gZBqhGv0fWl')
  })

  it('extracts share ID from URL with only shr', () => {
    const result = extractAirtableId('https://airtable.com/shrsPxTefOkvQAWRs')
    expect(result).toEqual({ type: 'share', id: 'shrsPxTefOkvQAWRs' })
  })

  it('returns unknown for invalid input', () => {
    const result = extractAirtableId('https://example.com/foo')
    expect(result.type).toBe('unknown')
  })

  it('handles empty input', () => {
    const result = extractAirtableId('')
    expect(result).toEqual({ type: 'unknown', id: '' })
  })
})

describe('extractShareIdFromUrl', () => {
  it('preserves full path from URL with app and shr', () => {
    const id = extractShareIdFromUrl('https://airtable.com/appq84gZBqhGv0fWl/shrsPxTefOkvQAWRs')
    expect(id).toBe('appq84gZBqhGv0fWl/shrsPxTefOkvQAWRs')
  })

  it('extracts share ID from URL with only shr', () => {
    const id = extractShareIdFromUrl('https://airtable.com/shrsPxTefOkvQAWRs')
    expect(id).toBe('shrsPxTefOkvQAWRs')
  })

  it('extracts app ID from URL with only app', () => {
    const id = extractShareIdFromUrl('https://airtable.com/appq84gZBqhGv0fWl')
    expect(id).toBe('appq84gZBqhGv0fWl')
  })

  it('handles direct shr ID input', () => {
    const id = extractShareIdFromUrl('shrsPxTefOkvQAWRs')
    expect(id).toBe('shrsPxTefOkvQAWRs')
  })

  it('handles direct app ID input', () => {
    const id = extractShareIdFromUrl('appq84gZBqhGv0fWl')
    expect(id).toBe('appq84gZBqhGv0fWl')
  })

  it('throws for invalid URL', () => {
    expect(() => extractShareIdFromUrl('https://example.com/foo')).toThrow()
  })
})
