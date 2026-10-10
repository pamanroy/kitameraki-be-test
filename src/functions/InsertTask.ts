import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'

export async function InsertTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const { organizationId } = request.params
  const body = { ...((await request.json()) as object), organizationId }

  const createdTask = await getTasksContainer().items.create(body)

  return { jsonBody: createdTask.resource, status: 200 }
}

app.http('InsertTask', {
  methods: ['POST'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: InsertTask
})
