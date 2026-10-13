import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CreateTaskRequest } from '~/models/task'

const BASE_URL = process.env.API_URL ?? 'http://localhost:7071/api'
const organizationId = randomUUID()
const tasksUrl = (org = organizationId) => `${BASE_URL}/organizations/${org}/tasks`

async function call(url: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(url, {
    method: init?.method,
    headers: { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function createTask(overrides: Partial<CreateTaskRequest> = {}): Promise<CreateTaskRequest & { id: string }> {
  const task: CreateTaskRequest = { title: 'Task', status: 'todo', ...overrides }
  const response = await call(tasksUrl(), { method: 'POST', body: task })
  expect(response.status).toBe(201)
  return { ...task, id: response.body.id }
}

async function list(query = '') {
  const response = await call(`${tasksUrl()}${query ? `?${query}` : ''}`)
  expect(response.status).toBe(200)
  return response.body as { items: { id: string; title: string }[]; page: number; pageSize: number; total: number }
}

const titles = (page: { items: { title: string }[] }) => page.items.map(item => item.title).sort()

beforeAll(async () => {
  try {
    await fetch(BASE_URL)
  } catch {
    throw new Error(`API not reachable at ${BASE_URL}. Start the Cosmos emulator and run "npm start" first.`)
  }
})

afterAll(async () => {
  const { items } = await list('pageSize=100')
  if (items.length) await call(tasksUrl(), { method: 'DELETE', body: items.map(item => item.id) })
})

describe('create and read', () => {
  it('creates a task and reads it back with the organizationId from the route', async () => {
    const task = await createTask({ title: 'Round trip', priority: 'high', tags: ['a', 'b'], description: 'details' })

    const response = await call(`${tasksUrl()}/${task.id}`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ ...task, organizationId })
  })

  it('generates a uuid id and ignores an id sent in the body', async () => {
    const sent = randomUUID()
    const response = await call(tasksUrl(), { method: 'POST', body: { id: sent, title: 'Own id', status: 'todo' } })
    expect(response.status).toBe(201)
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.body.id).not.toBe(sent)
  })

  it('takes the organizationId from the route and ignores unknown body fields', async () => {
    const task = { title: 'Extra fields', status: 'todo', organizationId: randomUUID(), unknown: true }
    const created = await call(tasksUrl(), { method: 'POST', body: task })
    expect(created.status).toBe(201)

    const response = await call(`${tasksUrl()}/${created.body.id}`)
    expect(response.body).toMatchObject({ organizationId })
    expect(response.body).not.toHaveProperty('unknown')
  })

  it('returns 400 with field issues for an invalid body', async () => {
    const response = await call(tasksUrl(), { method: 'POST', body: { title: 'x', status: 'done' } })
    expect(response.status).toBe(400)
    expect(response.body.issues.map((issue: { path: string }) => issue.path).sort()).toEqual(['status'])
  })

  it('returns 400 for a body that is not JSON', async () => {
    const response = await fetch(tasksUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
    expect(response.status).toBe(400)
  })

  it('returns 404 for a missing task', async () => {
    expect((await call(`${tasksUrl()}/${randomUUID()}`)).status).toBe(404)
  })

  it('does not return a task from another organization', async () => {
    const task = await createTask()
    expect((await call(`${tasksUrl(randomUUID())}/${task.id}`)).status).toBe(404)
  })

  it('returns 400 for non-uuid route params', async () => {
    expect((await call(`${BASE_URL}/organizations/abc/tasks`)).status).toBe(400)
    expect((await call(`${tasksUrl()}/abc`)).status).toBe(400)
  })
})

describe('update', () => {
  it('changes only the supplied fields', async () => {
    const task = await createTask({ title: 'Keep me', priority: 'low' })

    const response = await call(`${tasksUrl()}/${task.id}`, { method: 'PATCH', body: { status: 'completed' } })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: task.id, title: 'Keep me', priority: 'low', status: 'completed' })
  })

  it('clears dueDate and priority when they are null', async () => {
    const task = await createTask({ title: 'Clear me', priority: 'high', dueDate: '2030-01-01T00:00:00.000Z' })

    const response = await call(`${tasksUrl()}/${task.id}`, { method: 'PATCH', body: { dueDate: null, priority: null } })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: task.id, title: 'Clear me' })
    expect(response.body).not.toHaveProperty('dueDate')
    expect(response.body).not.toHaveProperty('priority')
  })

  it('accepts null for a value the task does not have', async () => {
    const task = await createTask({ title: 'Nothing to clear' })

    const response = await call(`${tasksUrl()}/${task.id}`, { method: 'PATCH', body: { priority: null, title: 'Renamed' } })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: task.id, title: 'Renamed' })
  })

  it('returns 400 for null on a required field', async () => {
    const task = await createTask()
    expect((await call(`${tasksUrl()}/${task.id}`, { method: 'PATCH', body: { title: null } })).status).toBe(400)
  })

  it('returns 400 for an empty body', async () => {
    const task = await createTask()
    expect((await call(`${tasksUrl()}/${task.id}`, { method: 'PATCH', body: {} })).status).toBe(400)
  })

  it('ignores id and organizationId in the body', async () => {
    const task = await createTask()
    const response = await call(`${tasksUrl()}/${task.id}`, {
      method: 'PATCH',
      body: { status: 'completed', id: randomUUID(), organizationId: randomUUID() }
    })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: task.id, organizationId, status: 'completed' })
  })

  it('returns 400 when the body only has ignored fields', async () => {
    const task = await createTask()
    expect((await call(`${tasksUrl()}/${task.id}`, { method: 'PATCH', body: { id: randomUUID() } })).status).toBe(400)
  })

  it('returns 404 for a missing task', async () => {
    expect((await call(`${tasksUrl()}/${randomUUID()}`, { method: 'PATCH', body: { status: 'todo' } })).status).toBe(404)
  })
})

describe('delete', () => {
  it('deletes a task, then returns 404 for it', async () => {
    const task = await createTask()
    expect((await call(`${tasksUrl()}/${task.id}`, { method: 'DELETE' })).status).toBe(204)
    expect((await call(`${tasksUrl()}/${task.id}`)).status).toBe(404)
    expect((await call(`${tasksUrl()}/${task.id}`, { method: 'DELETE' })).status).toBe(404)
  })

  it('bulk deletes, ignoring ids that no longer exist', async () => {
    const [first, second] = [await createTask(), await createTask()]
    const response = await call(tasksUrl(), { method: 'DELETE', body: [first.id, second.id, randomUUID()] })
    expect(response.status).toBe(204)
    expect((await call(`${tasksUrl()}/${first.id}`)).status).toBe(404)
    expect((await call(`${tasksUrl()}/${second.id}`)).status).toBe(404)
  })

  it('returns 400 for a bulk delete body that is not an array of uuids', async () => {
    expect((await call(tasksUrl(), { method: 'DELETE', body: ['abc'] })).status).toBe(400)
  })
})

describe('listing', () => {
  const listOrg = randomUUID()
  const listUrl = (query = '') => `${tasksUrl(listOrg)}${query ? `?${query}` : ''}`
  const created: string[] = []

  async function listPage(query = '') {
    const response = await call(listUrl(query))
    expect(response.status).toBe(200)
    return response.body as { items: { id: string; title: string }[]; page: number; pageSize: number; total: number }
  }

  beforeAll(async () => {
    const tasks: CreateTaskRequest[] = [
      { title: 'Fix Login bug', status: 'todo', priority: 'high', tags: ['bug', 'login'], description: 'users cannot sign in' },
      { title: 'Write docs', status: 'todo', priority: 'low', tags: ['docs'] },
      { title: 'Ship release', status: 'completed', priority: 'high', tags: ['bug'] },
      { title: 'Review PR', status: 'in-progress', priority: 'medium', tags: [], description: 'check the LOGIN flow' },
      { title: 'No tags or priority', status: 'todo' }
    ]
    for (const task of tasks) {
      const response = await call(listUrl().split('?')[0], { method: 'POST', body: task })
      expect(response.status).toBe(201)
      created.push(response.body.id)
    }
  })

  afterAll(async () => {
    await call(tasksUrl(listOrg), { method: 'DELETE', body: created })
  })

  it('returns everything with the default paging and a total', async () => {
    const page = await listPage()
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 5 })
    expect(page.items).toHaveLength(5)
  })

  it('splits results across pages with no overlap or gaps', async () => {
    const pages = [await listPage('page=1&pageSize=2'), await listPage('page=2&pageSize=2'), await listPage('page=3&pageSize=2')]
    expect(pages.map(page => page.items.length)).toEqual([2, 2, 1])
    expect(pages.every(page => page.total === 5)).toBe(true)
    const ids = pages.flatMap(page => page.items.map(item => item.id))
    expect(new Set(ids).size).toBe(5)
    expect([...ids].sort()).toEqual([...created].sort())
  })

  it('returns an empty page past the end but still reports the total', async () => {
    expect(await listPage('page=9&pageSize=2')).toMatchObject({ items: [], total: 5 })
  })

  it('filters by status, priority and tag', async () => {
    expect(titles(await listPage('status=todo'))).toEqual(['Fix Login bug', 'No tags or priority', 'Write docs'])
    expect(titles(await listPage('priority=high'))).toEqual(['Fix Login bug', 'Ship release'])
    expect(titles(await listPage('tag=bug'))).toEqual(['Fix Login bug', 'Ship release'])
    expect(titles(await listPage('tag=nope'))).toEqual([])
  })

  it('requires all tags when several are given', async () => {
    expect(titles(await listPage('tag=bug,login'))).toEqual(['Fix Login bug'])
    expect(titles(await listPage('tag=bug,docs'))).toEqual([])
  })

  it('matches tags case-insensitively', async () => {
    expect(titles(await listPage('tag=BUG'))).toEqual(['Fix Login bug', 'Ship release'])
    expect(titles(await listPage('tag=Bug,LOGIN'))).toEqual(['Fix Login bug'])
  })

  it('combines filters and reports the filtered total', async () => {
    const page = await listPage('status=todo&priority=high&tag=bug')
    expect(titles(page)).toEqual(['Fix Login bug'])
    expect(page.total).toBe(1)
  })

  it('searches title and description case-insensitively', async () => {
    expect(titles(await listPage('q=login'))).toEqual(['Fix Login bug', 'Review PR'])
    expect(titles(await listPage('q=SIGN%20IN'))).toEqual(['Fix Login bug'])
    expect(titles(await listPage('q=login&status=in-progress'))).toEqual(['Review PR'])
  })

  it('does not leak tasks from other organizations', async () => {
    expect((await list()).items.every(item => !created.includes(item.id))).toBe(true)
  })

  it.each(['page=0', 'page=abc', 'pageSize=0', 'pageSize=101', 'status=done', 'priority=urgent', 'q=%20%20'])('returns 400 for %s', async query => {
    expect((await call(listUrl(query))).status).toBe(400)
  })
})
