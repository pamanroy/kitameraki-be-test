import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { z } from 'zod'

type ParsedBody<T> = { data: T } | { error: HttpResponseInit }

function toIssues(error: z.ZodError) {
  return error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
}

export async function parseBody<T extends z.ZodTypeAny>(request: HttpRequest, schema: T): Promise<ParsedBody<z.infer<T>>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { error: { status: 400, jsonBody: { error: 'Request body must be valid JSON' } } }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    return { error: { status: 400, jsonBody: { error: 'Invalid request body', issues: toIssues(result.error) } } }
  }

  return { data: result.data }
}

export function parseQuery<T extends z.ZodTypeAny>(request: HttpRequest, schema: T): ParsedBody<z.infer<T>> {
  const result = schema.safeParse(Object.fromEntries(request.query))
  if (!result.success) {
    return { error: { status: 400, jsonBody: { error: 'Invalid query parameters', issues: toIssues(result.error) } } }
  }

  return { data: result.data }
}
