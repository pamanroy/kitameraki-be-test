import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_FORM_ROWS } from '~/models/formSettings'

const BASE_URL = process.env.API_URL ?? 'http://localhost:7071/api'
const organizationId = randomUUID()
const tasksUrl = `${BASE_URL}/organizations/${organizationId}/tasks`
const settingsUrl = `${BASE_URL}/organizations/${organizationId}/form-settings`

async function call(url: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(url, {
    method: init?.method,
    headers: { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

const field = (type: string) => ({ builtIn: false, id: randomUUID(), label: type, type })
const text = field('text')
const email = field('email')
const date = field('date')
const datetime = field('datetime')

const task = (customFields?: Record<string, string>) => ({ title: 'Task', status: 'todo', customFields })

async function createTask(customFields?: Record<string, string>) {
  const response = await call(tasksUrl, { method: 'POST', body: task(customFields) })
  expect(response.status).toBe(201)
  return response.body as { id: string; customFields?: Record<string, string> }
}

beforeAll(async () => {
  try {
    await fetch(BASE_URL)
  } catch {
    throw new Error(`API not reachable at ${BASE_URL}. Start the Cosmos emulator and run "npm start" first.`)
  }
  const rows = [...DEFAULT_FORM_ROWS, [text, email], [date, datetime]]
  expect((await call(settingsUrl, { method: 'PUT', body: { rows } })).status).toBe(200)
})

afterAll(async () => {
  const { body } = await call(`${tasksUrl}?pageSize=100`)
  if (body.items.length) await call(tasksUrl, { method: 'DELETE', body: body.items.map((item: { id: string }) => item.id) })
})

describe('custom field values', () => {
  it('saves valid values and returns them', async () => {
    const customFields = {
      [text.id]: 'hello',
      [email.id]: 'a@b.com',
      [date.id]: '2026-10-11',
      [datetime.id]: '2026-10-11T10:00:00Z'
    }
    const created = await createTask(customFields)

    const response = await call(`${tasksUrl}/${created.id}`)
    expect(response.body.customFields).toEqual(customFields)
  })

  it('rejects values that do not match the field type on create and update', async () => {
    const bad = [
      { [email.id]: 'not-an-email' },
      { [date.id]: '11/10/2026' },
      { [datetime.id]: '2026-10-11' },
      { [datetime.id]: '2026-10-11T10:00:00+07:00' }
    ]
    for (const customFields of bad) {
      expect((await call(tasksUrl, { method: 'POST', body: task(customFields) })).status).toBe(400)
    }

    const created = await createTask({ [text.id]: 'ok' })
    for (const customFields of bad) {
      expect((await call(`${tasksUrl}/${created.id}`, { method: 'PATCH', body: { customFields } })).status).toBe(400)
    }
  })

  it('ignores keys that are not custom fields in the settings', async () => {
    const created = await createTask({ [text.id]: 'kept', [randomUUID()]: 'unknown', title: 'not a field' })

    const response = await call(`${tasksUrl}/${created.id}`)
    expect(response.body.customFields).toEqual({ [text.id]: 'kept' })
  })

  it('replaces the values on update', async () => {
    const created = await createTask({ [text.id]: 'before', [email.id]: 'a@b.com' })

    const response = await call(`${tasksUrl}/${created.id}`, { method: 'PATCH', body: { customFields: { [text.id]: 'after' } } })
    expect(response.status).toBe(200)
    expect(response.body.customFields).toEqual({ [text.id]: 'after' })
  })

  it('adds values on update to a task that had none', async () => {
    const created = await createTask()

    const response = await call(`${tasksUrl}/${created.id}`, { method: 'PATCH', body: { customFields: { [text.id]: 'new' } } })
    expect(response.status).toBe(200)
    expect(response.body.customFields).toEqual({ [text.id]: 'new' })
  })

  it('still reads, lists and updates a task after its custom field is deleted from the settings', async () => {
    const removable = field('text')
    await call(settingsUrl, { method: 'PUT', body: { rows: [...DEFAULT_FORM_ROWS, [removable]] } })

    const created = await createTask({ [removable.id]: 'orphan' })

    await call(settingsUrl, { method: 'PUT', body: { rows: DEFAULT_FORM_ROWS } })

    const read = await call(`${tasksUrl}/${created.id}`)
    expect(read.status).toBe(200)
    expect(read.body.customFields).toEqual({ [removable.id]: 'orphan' })

    const list = await call(`${tasksUrl}?pageSize=100`)
    expect(list.status).toBe(200)
    expect(list.body.items.some((item: { id: string }) => item.id === created.id)).toBe(true)

    const update = await call(`${tasksUrl}/${created.id}`, { method: 'PATCH', body: { title: 'Renamed' } })
    expect(update.status).toBe(200)
  })
})
