import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'

export async function GetTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const { id, organizationId } = request.params

  const task = await getTasksContainer().item(id, organizationId).read()

  return { jsonBody: task.resource, status: 200 }
}

app.http('GetTask', {
  methods: ['GET'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: GetTask
})
