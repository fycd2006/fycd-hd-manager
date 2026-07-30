import { mapAirtableFieldToInternal, parseAirtableBasePayload } from '../airtable/airtableImporter'

describe('mapAirtableFieldToInternal', () => {
  it('correctly maps Airtable types to internal system types', () => {
    expect(mapAirtableFieldToInternal('singleLineText').type).toBe('text')
    expect(mapAirtableFieldToInternal('multilineText').type).toBe('text')
    expect(mapAirtableFieldToInternal('number').type).toBe('number')
    expect(mapAirtableFieldToInternal('currency').type).toBe('number')
    expect(mapAirtableFieldToInternal('singleSelect').type).toBe('single_select')
    expect(mapAirtableFieldToInternal('multipleSelects').type).toBe('multiple_select')
    expect(mapAirtableFieldToInternal('multipleRecordLinks').type).toBe('link_row')
    expect(mapAirtableFieldToInternal('formula').type).toBe('formula')
    expect(mapAirtableFieldToInternal('checkbox').type).toBe('checkbox')
    expect(mapAirtableFieldToInternal('multipleAttachments').type).toBe('file')
    expect(mapAirtableFieldToInternal('unknownType').type).toBe('text')
  })
})

describe('parseAirtableBasePayload', () => {
  it('converts raw Airtable payload into structured tables and rows', () => {
    const mockPayload = {
      name: 'Sample Airtable Base',
      tables: [
        {
          id: 'tbl1',
          name: 'Projects',
          fields: [
            { id: 'fld1', name: 'Project Name', type: 'singleLineText' },
            { id: 'fld2', name: 'Budget', type: 'currency' },
            { id: 'fld3', name: 'Status', type: 'singleSelect', options: { choices: [{ id: 'opt1', name: 'Active' }] } }
          ],
          records: [
            {
              id: 'rec1',
              cellValuesByFieldId: {
                fld1: 'Alpha Release',
                fld2: 5000,
                fld3: 'Active'
              }
            }
          ]
        }
      ]
    }

    const result = parseAirtableBasePayload(mockPayload)

    expect(result.length).toBe(1)
    expect(result[0].name).toBe('Projects')
    expect(result[0].fields.length).toBe(3)
    expect(result[0].fields[0].type).toBe('text')
    expect(result[0].fields[1].type).toBe('number')
    expect(result[0].fields[2].type).toBe('single_select')

    expect(result[0].rows.length).toBe(1)
    expect(result[0].rows[0].data['Project Name']).toBe('Alpha Release')
    expect(result[0].rows[0].data['Budget']).toBe(5000)
  })
})
