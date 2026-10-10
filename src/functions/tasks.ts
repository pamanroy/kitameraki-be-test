import { app, HttpHandler, HttpMethod, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'
import { withErrorHandling } from '~/errors'
import {
  bulkDeleteTasksRequestSchema,
  createTaskRequestSchema,
  DeleteTaskRequest,
  GetTaskParams,
  GetTasksParams,
  updateTaskRequestSchema
} from '~/models/task'
import { parseBody } from '~/validation'

export async function GetTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const { id, organizationId } = request.params as GetTaskParams
  const task = await getTasksContainer().item(id, organizationId).read()
  if (!task.resource) return { status: 404, jsonBody: { error: 'Task not found' } }

  return { jsonBody: task.resource, status: 200 }
}

export async function GetTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const { organizationId } = request.params as GetTasksParams
  const task = await getTasksContainer()
    .items.query({
      query: 'SELECT * FROM c WHERE c.organizationId = @organizationId',
      parameters: [{ name: '@organizationId', value: organizationId }]
    })
    .fetchNext()

  return { jsonBody: task.resources, status: 200 }
}

export async function InsertTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const { organizationId } = request.params as GetTasksParams
  const parsed = await parseBody(request, createTaskRequestSchema)
  if ('error' in parsed) return parsed.error

  const createdTask = await getTasksContainer().items.create({ ...parsed.data, organizationId })

  return { jsonBody: createdTask.resource, status: 201 }
}

export async function UpdateTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const { id, organizationId } = request.params as GetTaskParams
  const parsed = await parseBody(request, updateTaskRequestSchema)
  if ('error' in parsed) return parsed.error

  const patchRequests = Object.entries(parsed.data).map(([key, value]) => ({
    op: 'replace' as const,
    path: `/${key}`,
    value
  }))
  const updatedTask = await getTasksContainer().item(id, organizationId).patch(patchRequests)

  return { jsonBody: updatedTask.resource, status: 200 }
}

export async function DeleteTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const { id, organizationId } = request.params as DeleteTaskRequest
  await getTasksContainer().item(id, organizationId).delete()

  return { status: 204 }
}

export async function BulkDeleteTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)
  const { organizationId } = request.params as GetTasksParams
  const parsed = await parseBody(request, bulkDeleteTasksRequestSchema)
  if ('error' in parsed) return parsed.error

  const container = getTasksContainer()
  const results = await Promise.allSettled(parsed.data.map(id => container.item(id, organizationId).delete()))

  const failure = results.find(result => result.status === 'rejected' && result.reason?.code !== 404)
  if (failure) throw (failure as PromiseRejectedResult).reason

  return { status: 204 }
}

const TASKS_ROUTE = 'organizations/{organizationId}/tasks'
const TASK_ROUTE = `${TASKS_ROUTE}/{id}`

function register(method: HttpMethod, route: string, handler: HttpHandler) {
  app.http(handler.name, { methods: [method], route, authLevel: 'anonymous', handler: withErrorHandling(handler) })
}

register('GET', TASK_ROUTE, GetTask)
register('GET', TASKS_ROUTE, GetTasks)
register('POST', TASKS_ROUTE, InsertTask)
register('PATCH', TASK_ROUTE, UpdateTask)
register('DELETE', TASK_ROUTE, DeleteTask)
register('DELETE', TASKS_ROUTE, BulkDeleteTasks)
