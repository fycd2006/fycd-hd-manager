import { parseCursor, generateCursor } from '../multiTableQuery'

describe('multiTableQuery cursor serialization', () => {
  it('should encode and decode cursor seamlessly', () => {
    const row = {
      createdAt: new Date('2026-08-13T10:15:30.123Z'),
      tableId: 42,
      id: 999
    }

    const cursorStr = generateCursor(row)
    
    // Ensure it does not contain raw hyphens and is properly base64 encoded
    expect(cursorStr.includes('-')).toBe(false)
    
    const decoded = parseCursor(cursorStr)
    expect(decoded).not.toBeNull()
    expect(decoded?.dateObj.getTime()).toBe(row.createdAt.getTime())
    expect(decoded?.tableId).toBe(row.tableId)
    expect(decoded?.rowId).toBe(row.id)
  })

  it('should return null for invalid cursor', () => {
    expect(parseCursor('invalid-base64-string!')).toBeNull()
    
    // Valid Base64 but invalid JSON
    const invalidJsonBase64 = Buffer.from('just a string, not json').toString('base64')
    expect(parseCursor(invalidJsonBase64)).toBeNull()
    
    // Valid JSON but missing required fields
    const missingFieldsBase64 = Buffer.from(JSON.stringify({ tableId: 10 })).toString('base64')
    expect(parseCursor(missingFieldsBase64)).toBeNull()
  })
})
