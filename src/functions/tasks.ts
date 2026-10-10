import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'
import {
  BulkDeleteTasksRequest,
  CreateTaskRequest,
  DeleteTaskRequest,
  EDITABLE_TASK_FIELDS,
  GetTaskParams,
  GetTasksParams,
  UpdateTaskRequest
} from '~/models/task'

export async function GetTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const { id, organizationId } = request.params as GetTaskParams
  const task = await getTasksContainer().item(id, organizationId).read()
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
  const body = { ...((await request.json()) as CreateTaskRequest), organizationId }

  const createdTask = await getTasksContainer().items.create(body)

  return { jsonBody: createdTask.resource, status: 200 }
}

export async function UpdateTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json()) as UpdateTaskRequest
  const { id, organizationId } = request.params as GetTaskParams

  const forbiddenFields = Object.keys(body).filter(key => !(EDITABLE_TASK_FIELDS as readonly string[]).includes(key))
  if (forbiddenFields.length > 0) {
    return { status: 400, jsonBody: { error: `Fields cannot be updated: ${forbiddenFields.join(', ')}` } }
  }

  const patchRequests = Object.entries(body).map(([key, value]) => ({
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

  return { status: 200 }
}

export async function BulkDeleteTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)
  const body = (await request.json()) as BulkDeleteTasksRequest
  const { organizationId } = request.params as GetTasksParams

  const container = getTasksContainer()
  await Promise.all(body.map(id => container.item(id, organizationId).delete()))

  return { status: 200 }
}

app.http('GetTask', {
  methods: ['GET'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: GetTask
})

app.http('GetTasks', {
  methods: ['GET'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: GetTasks
})

app.http('InsertTask', {
  methods: ['POST'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: InsertTask
})

app.http('UpdateTask', {
  methods: ['PATCH'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: UpdateTask
})

app.http('DeleteTask', {
  methods: ['DELETE'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: DeleteTask
})

app.http('BulkDeleteTasks', {
  methods: ['DELETE'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: BulkDeleteTasks
})
