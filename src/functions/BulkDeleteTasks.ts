import { CosmosClient } from '@azure/cosmos'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

export async function BulkDeleteTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)
  const body = (await request.json()) as string[]
  const organizationId = request.params.organizationId

  const client = new CosmosClient('this is a connection string')
  body.forEach(async element => {
    await client.database('TaskApp').container('Tasks').item(element, organizationId).delete()
  })

  return { status: 200 }
}

app.http('BulkDeleteTasks', {
  methods: ['DELETE'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: BulkDeleteTasks
})
