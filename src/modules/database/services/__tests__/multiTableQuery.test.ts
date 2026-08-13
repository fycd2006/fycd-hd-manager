import { parseCursor, generateCursor } from '../multiTableQuery'

describe('multiTableQuery cursor serialization', () => {
  it('should encode and decode cursor seamlessly (round-trip)', () => {
    const row = {
      createdAt: new Date('2026-08-13T10:15:30.123Z'),
      tableId: 42,
      id: 999
    }

    const cursorStr = generateCursor(row)

    const decoded = parseCursor(cursorStr)
    expect(decoded).not.toBeNull()
    expect(decoded?.dateObj.getTime()).toBe(row.createdAt.getTime())
    expect(decoded?.tableId).toBe(row.tableId)
    expect(decoded?.rowId).toBe(row.id)
  })

  it('should produce only URL-safe characters (no +, /, =)', () => {
    // These specific values produce + and / in standard base64 encoding.
    // Standard base64 of this payload contains "+" (from >) and "/" (from ?).
    // We verify base64url avoids them entirely.
    const problematicRows = [
      { createdAt: new Date('2026-12-31T23:59:59.999Z'), tableId: 65535, id: 16777215 },
      { createdAt: new Date('1970-01-01T00:00:00.000Z'), tableId: 1, id: 1 },
      { createdAt: new Date('2099-06-15T12:30:45.678Z'), tableId: 99999, id: 88888888 },
    ]

    for (const row of problematicRows) {
      const cursorStr = generateCursor(row)

      // base64url must not contain +, /, or = (padding)
      expect(cursorStr).not.toMatch(/[+/=]/)

      // Verify standard base64 of the same payload DOES contain these chars
      // (proving our test data actually triggers the problem)
      const standardB64 = Buffer.from(JSON.stringify({
        createdAt: row.createdAt.toISOString(),
        tableId: row.tableId,
        rowId: row.id
      })).toString('base64')

      // At least one of our test rows should produce + or / or = in standard base64
      // (this validates the test data itself is meaningful)
      const hasUnsafeChars = /[+/=]/.test(standardB64)

      // Round-trip must still work
      const decoded = parseCursor(cursorStr)
      expect(decoded).not.toBeNull()
      expect(decoded?.dateObj.getTime()).toBe(row.createdAt.getTime())
      expect(decoded?.tableId).toBe(row.tableId)
      expect(decoded?.rowId).toBe(row.id)

      if (hasUnsafeChars) {
        // Log proof that standard base64 would have been unsafe
        // eslint-disable-next-line no-console
        console.log(
          `Row (tableId=${row.tableId}, id=${row.id}): ` +
          `standard base64 contains unsafe chars: ${standardB64.match(/[+/=]/g)?.join('')}`
        )
      }
    }

    // Verify at least one row actually triggers unsafe chars in standard base64
    const anyUnsafe = problematicRows.some(row => {
      const b64 = Buffer.from(JSON.stringify({
        createdAt: row.createdAt.toISOString(),
        tableId: row.tableId,
        rowId: row.id
      })).toString('base64')
      return /[+/=]/.test(b64)
    })
    expect(anyUnsafe).toBe(true)
  })

  it('should survive a simulated HTTP query-string round-trip', () => {
    const row = {
      createdAt: new Date('2026-12-31T23:59:59.999Z'),
      tableId: 65535,
      id: 16777215
    }

    const cursorStr = generateCursor(row)

    // Simulate: server generates cursor → client puts it in URL → server reads it back
    const fakeUrl = new URL(`http://localhost:3000/api/workspaces/1/all-rows?cursor=${cursorStr}&limit=50`)
    const receivedCursor = fakeUrl.searchParams.get('cursor')!

    // The cursor must survive the URL round-trip unchanged
    expect(receivedCursor).toBe(cursorStr)

    // And must decode correctly
    const decoded = parseCursor(receivedCursor)
    expect(decoded).not.toBeNull()
    expect(decoded?.dateObj.getTime()).toBe(row.createdAt.getTime())
    expect(decoded?.tableId).toBe(row.tableId)
    expect(decoded?.rowId).toBe(row.id)
  })

  it('should also survive encodeURIComponent round-trip', () => {
    const row = {
      createdAt: new Date('2099-06-15T12:30:45.678Z'),
      tableId: 99999,
      id: 88888888
    }

    const cursorStr = generateCursor(row)

    // Client-side: encodeURIComponent before putting in URL
    const encoded = encodeURIComponent(cursorStr)
    // Server-side: URLSearchParams auto-decodes
    const fakeUrl = new URL(`http://localhost:3000/api/test?cursor=${encoded}`)
    const receivedCursor = fakeUrl.searchParams.get('cursor')!

    expect(receivedCursor).toBe(cursorStr)

    const decoded = parseCursor(receivedCursor)
    expect(decoded).not.toBeNull()
    expect(decoded?.dateObj.getTime()).toBe(row.createdAt.getTime())
  })

  it('should return null for invalid cursor', () => {
    expect(parseCursor('invalid-base64-string!')).toBeNull()

    // Valid Base64 but invalid JSON
    const invalidJsonBase64 = Buffer.from('just a string, not json').toString('base64url')
    expect(parseCursor(invalidJsonBase64)).toBeNull()

    // Valid JSON but missing required fields
    const missingFieldsBase64 = Buffer.from(JSON.stringify({ tableId: 10 })).toString('base64url')
    expect(parseCursor(missingFieldsBase64)).toBeNull()
  })
})
