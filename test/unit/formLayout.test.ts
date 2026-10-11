import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { addMissingBuiltInFields } from '~/formLayout'
import { DEFAULT_FORM_ROWS } from '~/models/formSettings'

const organizationId = randomUUID()

describe('addMissingBuiltInFields', () => {
  it('leaves complete settings unchanged', () => {
    const settings = { organizationId, rows: DEFAULT_FORM_ROWS }
    expect(addMissingBuiltInFields(settings)).toEqual(settings)
  })

  it('appends each missing built-in field as its own row at the end', () => {
    const rows = DEFAULT_FORM_ROWS.filter(row => row[0].id !== 'status' && row[0].id !== 'tags')
    const result = addMissingBuiltInFields({ organizationId, rows })

    expect(result.rows.slice(0, rows.length)).toEqual(rows)
    expect(result.rows.slice(rows.length)).toEqual([
      [{ builtIn: true, id: 'status', label: 'Status' }],
      [{ builtIn: true, id: 'tags', label: 'Tags' }]
    ])
  })
})
