import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'

export async function DeleteTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const { id, organizationId } = request.params

  await getTasksContainer().item(id, organizationId).delete()

  return { status: 200 }
}

app.http('DeleteTask', {
  methods: ['DELETE'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: DeleteTask
})
