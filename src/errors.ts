import { HttpHandler } from '@azure/functions'

export function withErrorHandling(handler: HttpHandler): HttpHandler {
  return async (request, context) => {
    context.log(`${request.method} ${request.url}`)
    try {
      return await handler(request, context)
    } catch (error) {
      switch ((error as { code?: unknown }).code) {
        case 404:
          return { status: 404, jsonBody: { error: 'Task not found' } }
        case 409:
          return { status: 409, jsonBody: { error: 'Task already exists' } }
        default:
          throw error
      }
    }
  }
}
