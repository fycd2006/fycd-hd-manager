import { mapAirtableFieldToInternal, parseAirtableBasePayload } from '../airtable/airtableImporter'

describe('mapAirtableFieldToInternal', () => {
  it('correctly maps REST API type names', () => {
    expect(mapAirtableFieldToInternal('singleLineText').type).toBe('text')
    expect(mapAirtableFieldToInternal('multilineText').type).toBe('long_text')
    expect(mapAirtableFieldToInternal('richText').type).toBe('long_text')
    expect(mapAirtableFieldToInternal('email').type).toBe('email')
    expect(mapAirtableFieldToInternal('url').type).toBe('url')
    expect(mapAirtableFieldToInternal('phoneNumber').type).toBe('phone')
    expect(mapAirtableFieldToInternal('number').type).toBe('number')
    expect(mapAirtableFieldToInternal('currency').type).toBe('number')
    expect(mapAirtableFieldToInternal('percent').type).toBe('number')
    expect(mapAirtableFieldToInternal('rating').type).toBe('rating')
    expect(mapAirtableFieldToInternal('count').type).toBe('count')
    expect(mapAirtableFieldToInternal('autoNumber').type).toBe('autonumber')
    expect(mapAirtableFieldToInternal('duration').type).toBe('duration')
    expect(mapAirtableFieldToInternal('singleSelect').type).toBe('single_select')
    expect(mapAirtableFieldToInternal('multipleSelects').type).toBe('multiple_select')
    expect(mapAirtableFieldToInternal('multipleRecordLinks').type).toBe('link_row')
    expect(mapAirtableFieldToInternal('formula').type).toBe('formula')
    expect(mapAirtableFieldToInternal('rollup').type).toBe('rollup')
    expect(mapAirtableFieldToInternal('lookup').type).toBe('lookup')
    expect(mapAirtableFieldToInternal('createdTime').type).toBe('created_on')
    expect(mapAirtableFieldToInternal('lastModifiedTime').type).toBe('last_modified_on')
    expect(mapAirtableFieldToInternal('singleCollaborator').type).toBe('collaborator')
    expect(mapAirtableFieldToInternal('multipleCollaborators').type).toBe('collaborator')
    expect(mapAirtableFieldToInternal('createdBy').type).toBe('created_by')
    expect(mapAirtableFieldToInternal('lastModifiedBy').type).toBe('last_modified_by')
    expect(mapAirtableFieldToInternal('checkbox').type).toBe('boolean')
    expect(mapAirtableFieldToInternal('multipleAttachments').type).toBe('file')
    expect(mapAirtableFieldToInternal('unknownType').type).toBe('text')
  })

  it('correctly maps v0.3 internal API type names', () => {
    expect(mapAirtableFieldToInternal('text').type).toBe('text')
    expect(mapAirtableFieldToInternal('select').type).toBe('single_select')
    expect(mapAirtableFieldToInternal('multiSelect').type).toBe('multiple_select')
    expect(mapAirtableFieldToInternal('foreignKey').type).toBe('link_row')
    expect(mapAirtableFieldToInternal('phone').type).toBe('phone')
    expect(mapAirtableFieldToInternal('multipleAttachment').type).toBe('file')
    expect(mapAirtableFieldToInternal('collaborator').type).toBe('collaborator')
    expect(mapAirtableFieldToInternal('duration').type).toBe('duration')
  })
})

describe('parseAirtableBasePayload', () => {
  it('resolves select choice IDs and preserves choice objects with color (REST API format)', () => {
    const mockPayload = {
      name: 'Sample Airtable Base',
      tables: [
        {
          id: 'tbl1',
          name: 'Projects',
          fields: [
            { id: 'fld1', name: 'Project Name', type: 'singleLineText' },
            { id: 'fld2', name: 'Budget', type: 'currency' },
            { id: 'fld3', name: 'Status', type: 'singleSelect', options: { choices: [{ id: 'sel1', name: 'Active', color: 'green' }, { id: 'sel2', name: 'Done', color: 'blue' }] } },
            { id: 'fld4', name: 'Tags', type: 'multipleSelects', options: { choices: [{ id: 'selA', name: 'Frontend' }, { id: 'selB', name: 'Backend' }] } },
            { id: 'fld5', name: 'Done', type: 'checkbox' },
            { id: 'fld6', name: 'Related', type: 'multipleRecordLinks' },
            { id: 'fld7', name: 'Assignee', type: 'singleCollaborator' },
          ],
          records: [
            {
              id: 'rec1',
              cellValuesByFieldId: {
                fld1: 'Alpha Release',
                fld2: 5000,
                fld3: 'sel1',
                fld4: ['selA', 'selB'],
                fld5: true,
                fld6: ['rec99', 'rec88'],
                fld7: { id: 'usr1', name: 'Jeffrey', email: 'jeff@example.com' },
              }
            }
          ]
        }
      ]
    }

    const result = parseAirtableBasePayload(mockPayload)

    expect(result[0].fields[2].type).toBe('single_select')
    expect(result[0].fields[2].options).toEqual({
      choices: [
        { id: 'sel1', name: 'Active', color: 'green' },
        { id: 'sel2', name: 'Done', color: 'blue' },
      ]
    })
    expect(result[0].fields[6].type).toBe('collaborator')

    const row = result[0].rows[0].data
    expect(row['Project Name']).toBe('Alpha Release')
    expect(row['Budget']).toBe(5000)
    expect(row['Status']).toBe('Active')
    expect(row['Tags']).toEqual(['Frontend', 'Backend'])
    expect(row['Done']).toBe(true)
    expect(row['Related']).toBe('rec99, rec88')
    expect(row['Assignee']).toBe('Jeffrey')
  })

  it('handles v0.3 internal API format (select, foreignKey with foreignRowId objects)', () => {
    const mockPayload = {
      name: 'v0.3 Test',
      tables: [
        {
          id: 'tbl1',
          name: 'Members',
          fields: [
            { id: 'fld1', name: 'Name', type: 'text' },
            { id: 'fld2', name: 'Role', type: 'select', options: { choices: [{ id: 'selA', name: '組長' }, { id: 'selB', name: '組員' }] } },
            { id: 'fld3', name: 'Groups', type: 'multiSelect', options: { choices: [{ id: 'selX', name: '禱告組' }, { id: 'selY', name: '敬拜組' }] } },
            { id: 'fld4', name: 'Related', type: 'foreignKey' },
          ],
          records: [
            {
              id: 'rec1',
              cellValuesByFieldId: {
                fld1: '陳小明',
                fld2: 'selA',
                fld3: ['selX', 'selY'],
                fld4: [
                  { foreignRowId: 'recABC', foreignRowDisplayName: '李大偉' },
                  { foreignRowId: 'recDEF', foreignRowDisplayName: '王美玲' },
                ],
              }
            }
          ]
        }
      ]
    }

    const result = parseAirtableBasePayload(mockPayload)

    expect(result[0].fields[0].type).toBe('text')
    expect(result[0].fields[1].type).toBe('single_select')
    expect(result[0].fields[2].type).toBe('multiple_select')
    expect(result[0].fields[3].type).toBe('link_row')

    const row = result[0].rows[0].data
    expect(row['Name']).toBe('陳小明')
    expect(row['Role']).toBe('組長')
    expect(row['Groups']).toEqual(['禱告組', '敬拜組'])
    expect(row['Related']).toBe('李大偉, 王美玲')
  })
})


