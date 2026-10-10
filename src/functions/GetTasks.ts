import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'

export async function GetTasks(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)
  const { organizationId } = request.params

  const task = await getTasksContainer()
    .items.query({
      query: 'SELECT * FROM c WHERE c.organizationId = @organizationId',
      parameters: [{ name: '@organizationId', value: organizationId }]
    })
    .fetchNext()

  return { jsonBody: task.resources, status: 200 }
}

app.http('GetTasks', {
  methods: ['GET'],
  route: 'organizations/{organizationId}/tasks',
  authLevel: 'anonymous',
  handler: GetTasks
})
