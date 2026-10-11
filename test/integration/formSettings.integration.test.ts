import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_FORM_ROWS } from '~/models/formSettings'

const BASE_URL = process.env.API_URL ?? 'http://localhost:7071/api'
const settingsUrl = (org: string) => `${BASE_URL}/organizations/${org}/form-settings`

const writtenOrganizations: string[] = []
function newOrganization() {
  const organizationId = randomUUID()
  writtenOrganizations.push(organizationId)
  return organizationId
}

async function call(url: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(url, {
    method: init?.method,
    headers: { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

const customField = (label = 'Phone') => ({ builtIn: false, id: randomUUID(), label, type: 'text' })

beforeAll(async () => {
  try {
    await fetch(BASE_URL)
  } catch {
    throw new Error(`API not reachable at ${BASE_URL}. Start the Cosmos emulator and run "npm start" first.`)
  }
})

afterAll(async () => {
  await Promise.all(writtenOrganizations.map(org => call(settingsUrl(org), { method: 'DELETE' })))
})

describe('form settings', () => {
  it('returns the default settings when none are saved', async () => {
    const organizationId = randomUUID()
    const response = await call(settingsUrl(organizationId))
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ organizationId, rows: DEFAULT_FORM_ROWS })
  })

  it('saves settings and reads them back', async () => {
    const url = settingsUrl(newOrganization())
    const rows = [[...DEFAULT_FORM_ROWS[0], customField()], ...DEFAULT_FORM_ROWS.slice(1)]

    expect((await call(url, { method: 'PUT', body: { rows } })).status).toBe(200)

    const response = await call(url)
    expect(response.status).toBe(200)
    expect(response.body.rows).toEqual(rows)
  })

  it('replaces previously saved settings', async () => {
    const url = settingsUrl(newOrganization())
    await call(url, { method: 'PUT', body: { rows: [...DEFAULT_FORM_ROWS, [customField()]] } })
    await call(url, { method: 'PUT', body: { rows: DEFAULT_FORM_ROWS } })

    expect((await call(url)).body.rows).toEqual(DEFAULT_FORM_ROWS)
  })

  it('resets to the defaults on delete, and delete is idempotent', async () => {
    const url = settingsUrl(randomUUID())
    await call(url, { method: 'PUT', body: { rows: [...DEFAULT_FORM_ROWS, [customField()]] } })

    expect((await call(url, { method: 'DELETE' })).status).toBe(204)
    expect((await call(url)).body.rows).toEqual(DEFAULT_FORM_ROWS)
    expect((await call(url, { method: 'DELETE' })).status).toBe(204)
  })

  it('keeps settings separate per organization', async () => {
    const other = settingsUrl(randomUUID())
    await call(settingsUrl(newOrganization()), { method: 'PUT', body: { rows: [...DEFAULT_FORM_ROWS, [customField()]] } })

    expect((await call(other)).body.rows).toEqual(DEFAULT_FORM_ROWS)
  })

  it('rejects a row with more than 2 fields', async () => {
    const rows = [[...DEFAULT_FORM_ROWS[0], customField(), customField('Other')], ...DEFAULT_FORM_ROWS.slice(1)]
    expect((await call(settingsUrl(randomUUID()), { method: 'PUT', body: { rows } })).status).toBe(400)
  })

  it('rejects settings that drop a built-in field', async () => {
    const rows = DEFAULT_FORM_ROWS.slice(1)
    expect((await call(settingsUrl(randomUUID()), { method: 'PUT', body: { rows } })).status).toBe(400)
  })

  it('rejects duplicate field ids', async () => {
    const field = customField()
    const rows = [...DEFAULT_FORM_ROWS, [field], [field]]
    expect((await call(settingsUrl(randomUUID()), { method: 'PUT', body: { rows } })).status).toBe(400)
  })

  it('rejects an unsupported field type and an empty label', async () => {
    const badType = [...DEFAULT_FORM_ROWS, [{ ...customField(), type: 'number' }]]
    const emptyLabel = [...DEFAULT_FORM_ROWS, [customField('  ')]]
    expect((await call(settingsUrl(randomUUID()), { method: 'PUT', body: { rows: badType } })).status).toBe(400)
    expect((await call(settingsUrl(randomUUID()), { method: 'PUT', body: { rows: emptyLabel } })).status).toBe(400)
  })

  it('rejects an invalid organizationId and a non-JSON body', async () => {
    expect((await call(settingsUrl('not-a-uuid'))).status).toBe(400)
    const response = await fetch(settingsUrl(randomUUID()), { method: 'PUT', body: 'nope' })
    expect(response.status).toBe(400)
  })
})
