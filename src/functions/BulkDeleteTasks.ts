import { CosmosClient } from '@azure/cosmos'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

export async function BulkDeleteTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)
  const body = (await request.json()) as string[]
  const organizationId = request.params.organizationId

  const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
  const container = client.database('TaskApp').container('Tasks')
  await Promise.all(body.map(id => container.item(id, organizationId).delete()))

  return { status: 200 }
}

app.http('BulkDeleteTasks', {
  methods: ['DELETE'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: BulkDeleteTasks
})
