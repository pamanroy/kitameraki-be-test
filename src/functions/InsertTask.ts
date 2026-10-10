import { CosmosClient } from '@azure/cosmos'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

export async function InsertTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const organizationId = request.params.organizationId
  const body = { ...((await request.json()) as object), organizationId }

  const client = new CosmosClient('this is a connection string')
  const createdTask = await client.database('TaskApp').container('Tasks').items.create(body)

  return { jsonBody: createdTask.resource, status: 200 }
}

app.http('InsertTask', {
  methods: ['POST'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: InsertTask
})
