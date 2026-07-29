import test from 'node:test'
import assert from 'node:assert/strict'
import { mapAirtableFieldToInternal, parseAirtableBasePayload } from '../airtable/airtableImporter'

test('mapAirtableFieldToInternal - correctly maps Airtable types to internal system types', () => {
  assert.equal(mapAirtableFieldToInternal('singleLineText').type, 'text')
  assert.equal(mapAirtableFieldToInternal('multilineText').type, 'text')
  assert.equal(mapAirtableFieldToInternal('number').type, 'number')
  assert.equal(mapAirtableFieldToInternal('currency').type, 'number')
  assert.equal(mapAirtableFieldToInternal('singleSelect').type, 'single_select')
  assert.equal(mapAirtableFieldToInternal('multipleSelects').type, 'multiple_select')
  assert.equal(mapAirtableFieldToInternal('multipleRecordLinks').type, 'link_row')
  assert.equal(mapAirtableFieldToInternal('formula').type, 'formula')
  assert.equal(mapAirtableFieldToInternal('checkbox').type, 'checkbox')
  assert.equal(mapAirtableFieldToInternal('multipleAttachments').type, 'file')
  assert.equal(mapAirtableFieldToInternal('unknownType').type, 'text')
})

test('parseAirtableBasePayload - converts raw Airtable payload into structured tables and rows', () => {
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

  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Projects')
  assert.equal(result[0].fields.length, 3)
  assert.equal(result[0].fields[0].type, 'text')
  assert.equal(result[0].fields[1].type, 'number')
  assert.equal(result[0].fields[2].type, 'single_select')

  assert.equal(result[0].rows.length, 1)
  assert.equal(result[0].rows[0].data['Project Name'], 'Alpha Release')
  assert.equal(result[0].rows[0].data['Budget'], 5000)
})
