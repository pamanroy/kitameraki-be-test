import { HttpResponseInit } from '@azure/functions'
import { z } from 'zod'
import { getFormSettings } from '~/formSettings'
import { customFieldSchema } from '~/models/formSettings'

type CustomFieldType = z.infer<typeof customFieldSchema>['type']

const valueSchemas: Record<CustomFieldType, z.ZodTypeAny> = {
  text: z.string(),
  email: z.string().email(),
  date: z.string().date(),
  datetime: z.string().datetime()
}

type ValidatedCustomFields = { data: Record<string, string> } | { error: HttpResponseInit }

export async function validateCustomFields(
  organizationId: string,
  customFields: Record<string, string>
): Promise<ValidatedCustomFields> {
  const settings = await getFormSettings(organizationId)
  const types = new Map<string, CustomFieldType>()
  for (const field of settings.rows.flat()) {
    if (!field.builtIn) types.set(field.id, field.type)
  }

  const data: Record<string, string> = {}
  const issues: { path: string; message: string }[] = []
  for (const [id, value] of Object.entries(customFields)) {
    const type = types.get(id)
    if (!type) continue

    const result = valueSchemas[type].safeParse(value)
    if (result.success) {
      data[id] = value
    } else {
      issues.push({ path: `customFields.${id}`, message: result.error.issues[0].message })
    }
  }

  if (issues.length) return { error: { status: 400, jsonBody: { error: 'Invalid request body', issues } } }

  return { data }
}
