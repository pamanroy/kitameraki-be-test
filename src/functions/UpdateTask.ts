import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getTasksContainer } from '~/cosmos'

export async function UpdateTask(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json()) as object
  const { id, organizationId } = request.params

  let patchRequests = []

  for (let key in body) {
    patchRequests.push({
      op: 'replace',
      path: `/${key}`,
      value: body[key]
    })
  }

  const createdTask = await getTasksContainer().item(id, organizationId).patch(patchRequests)

  return { jsonBody: createdTask.resource, status: 200 }
}

app.http('UpdateTask', {
  methods: ['PATCH'],
  route: 'organizations/{organizationId}/tasks/{id}',
  authLevel: 'anonymous',
  handler: UpdateTask
})
