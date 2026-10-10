import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { z } from 'zod'

type ParsedBody<T> = { data: T } | { error: HttpResponseInit }

export async function parseBody<T extends z.ZodTypeAny>(request: HttpRequest, schema: T): Promise<ParsedBody<z.infer<T>>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { error: { status: 400, jsonBody: { error: 'Request body must be valid JSON' } } }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    const issues = result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
    return { error: { status: 400, jsonBody: { error: 'Invalid request body', issues } } }
  }

  return { data: result.data }
}
