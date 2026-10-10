import { CosmosClient } from '@azure/cosmos'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

export async function GetTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const taskId = request.params.id
  const organizationId = request.params.organizationId

  const client = new CosmosClient('this is a connection string')
  const task = await client.database('TaskApp').container('Tasks').item(taskId, organizationId).read()

  return { jsonBody: task.resource, status: 200 }
}

app.http('GetTask', {
  methods: ['GET'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: GetTask
})
