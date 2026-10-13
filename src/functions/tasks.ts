import { randomUUID } from 'node:crypto'
import { PatchOperation } from '@azure/cosmos'
import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { tasksContainer } from '~/cosmos'
import { validateCustomFields } from '~/customFields'
import { register } from '~/http'
import {
  bulkDeleteTasksRequestSchema,
  createTaskRequestSchema,
  deleteTaskRequestSchema,
  getTaskParamsSchema,
  getTasksParamsSchema,
  getTasksQuerySchema,
  updateTaskRequestSchema
} from '~/models/task'
import { parseBody, parseParams, parseQuery } from '~/validation'

export async function GetTask(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getTaskParamsSchema)
  if ('error' in params) return params.error

  const { id, organizationId } = params.data
  const task = await tasksContainer.item(id, organizationId).read()
  if (!task.resource) return { status: 404, jsonBody: { error: 'Task not found' } }

  return { jsonBody: task.resource, status: 200 }
}

export async function GetTasks(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getTasksParamsSchema)
  if ('error' in params) return params.error

  const { organizationId } = params.data
  const parsed = parseQuery(request, getTasksQuerySchema)
  if ('error' in parsed) return parsed.error

  const { page, pageSize, status, priority, tag, q } = parsed.data
  const conditions = ['c.organizationId = @organizationId']
  const parameters = [{ name: '@organizationId', value: organizationId }]
  if (status) {
    conditions.push('c.status = @status')
    parameters.push({ name: '@status', value: status })
  }
  if (priority) {
    conditions.push('c.priority = @priority')
    parameters.push({ name: '@priority', value: priority })
  }
  tag?.forEach((value, index) => {
    conditions.push(`EXISTS(SELECT VALUE t FROM t IN c.tags WHERE LOWER(t) = @tag${index})`)
    parameters.push({ name: `@tag${index}`, value: value.toLowerCase() })
  })
  if (q) {
    conditions.push('(CONTAINS(c.title, @q, true) OR CONTAINS(c.description, @q, true))')
    parameters.push({ name: '@q', value: q })
  }
  const where = conditions.join(' AND ')

  const [items, count] = await Promise.all([
    tasksContainer.items
      .query({
        query: `SELECT * FROM c WHERE ${where} ORDER BY c._ts DESC OFFSET @offset LIMIT @limit`,
        parameters: [...parameters, { name: '@offset', value: (page - 1) * pageSize }, { name: '@limit', value: pageSize }]
      })
      .fetchAll(),
    tasksContainer.items.query<number>({ query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`, parameters }).fetchAll()
  ])

  return { jsonBody: { items: items.resources, page, pageSize, total: count.resources[0] }, status: 200 }
}

export async function InsertTask(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getTasksParamsSchema)
  if ('error' in params) return params.error

  const { organizationId } = params.data
  const parsed = await parseBody(request, createTaskRequestSchema)
  if ('error' in parsed) return parsed.error

  let task = parsed.data
  if (task.customFields) {
    const customFields = await validateCustomFields(organizationId, task.customFields)
    if ('error' in customFields) return customFields.error
    task = { ...task, customFields: customFields.data }
  }

  const createdTask = await tasksContainer.items.create({ ...task, id: randomUUID(), organizationId })

  return { jsonBody: createdTask.resource, status: 201 }
}

export async function UpdateTask(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getTaskParamsSchema)
  if ('error' in params) return params.error

  const { id, organizationId } = params.data
  const parsed = await parseBody(request, updateTaskRequestSchema)
  if ('error' in parsed) return parsed.error

  let changes = parsed.data
  if (changes.customFields) {
    const customFields = await validateCustomFields(organizationId, changes.customFields)
    if ('error' in customFields) return customFields.error
    changes = { ...changes, customFields: customFields.data }
  }

  const item = tasksContainer.item(id, organizationId)
  const { resource: existing } = await item.read()
  if (!existing) return { status: 404, jsonBody: { error: 'Task not found' } }

  // null clears a field; Cosmos rejects removing a path that does not exist, so skip those
  const patchRequests = Object.entries(changes).flatMap(([key, value]): PatchOperation[] => {
    if (value !== null) return [{ op: 'set', path: `/${key}`, value }]
    return key in existing ? [{ op: 'remove', path: `/${key}` }] : []
  })
  if (patchRequests.length === 0) return { jsonBody: existing, status: 200 }

  const updatedTask = await item.patch(patchRequests)

  return { jsonBody: updatedTask.resource, status: 200 }
}

export async function DeleteTask(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, deleteTaskRequestSchema)
  if ('error' in params) return params.error

  const { id, organizationId } = params.data
  await tasksContainer.item(id, organizationId).delete()

  return { status: 204 }
}

export async function BulkDeleteTasks(request: HttpRequest): Promise<HttpResponseInit> {
  const params = parseParams(request, getTasksParamsSchema)
  if ('error' in params) return params.error

  const { organizationId } = params.data
  const parsed = await parseBody(request, bulkDeleteTasksRequestSchema)
  if ('error' in parsed) return parsed.error

  const results = await Promise.allSettled(parsed.data.map(id => tasksContainer.item(id, organizationId).delete()))

  const failure = results.find(result => result.status === 'rejected' && result.reason?.code !== 404)
  if (failure) throw (failure as PromiseRejectedResult).reason

  return { status: 204 }
}

const TASKS_ROUTE = 'organizations/{organizationId}/tasks'
const TASK_ROUTE = `${TASKS_ROUTE}/{id}`

register('GET', TASK_ROUTE, GetTask)
register('GET', TASKS_ROUTE, GetTasks)
register('POST', TASKS_ROUTE, InsertTask)
register('PATCH', TASK_ROUTE, UpdateTask)
register('DELETE', TASK_ROUTE, DeleteTask)
register('DELETE', TASKS_ROUTE, BulkDeleteTasks)
