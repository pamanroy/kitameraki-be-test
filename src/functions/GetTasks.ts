import { CosmosClient } from '@azure/cosmos'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

export async function GetTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)
  const organizationId = request.params.organizationId

  const client = new CosmosClient('this is a connection string')
  const task = await client
    .database('TaskApp')
    .container('Tasks')
    .items.query(`SELECT * FROM c WHERE c.organizationId = '${organizationId}'`)
    .fetchNext()

  return { jsonBody: task.resources, status: 200 }
}

app.http('GetTasks', {
  methods: ['GET'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: GetTasks
})
