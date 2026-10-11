import { app, HttpHandler, HttpMethod } from '@azure/functions'
import { withErrorHandling } from '~/errors'

export function register(method: HttpMethod, route: string, handler: HttpHandler) {
  app.http(handler.name, { methods: [method], route, authLevel: 'anonymous', handler: withErrorHandling(handler) })
}
