import { CosmosClient } from '@azure/cosmos'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

export async function DeleteTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const taskId = request.params.id
  const organizationId = request.params.organizationId

  const client = new CosmosClient('this is a connection string')
  await client.database('TaskApp').container('Tasks').item(taskId, organizationId).delete()

  return { status: 200 }
}

app.http('DeleteTask', {
  methods: ['DELETE'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: DeleteTask
})
