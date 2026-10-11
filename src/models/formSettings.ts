import { z } from 'zod'
import { taskSchema } from '~/models/task'

export const builtInFieldIdSchema = taskSchema.omit({ id: true, organizationId: true, customFields: true }).keyof()

const labelSchema = z.string().trim().min(1).max(50)

export const builtInFieldSchema = z.object({
  builtIn: z.literal(true),
  id: builtInFieldIdSchema,
  label: labelSchema
})

export const customFieldSchema = z.object({
  builtIn: z.literal(false),
  id: z.string().uuid(),
  label: labelSchema,
  type: z.enum(['text', 'date', 'datetime', 'email'])
})

export const formFieldSchema = z.discriminatedUnion('builtIn', [builtInFieldSchema, customFieldSchema])
export type FormField = z.infer<typeof formFieldSchema>

const formRowsSchema = z
  .array(z.array(formFieldSchema).min(1).max(2))
  .refine(
    rows => {
      const ids = rows.flat().map(field => field.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Field ids must be unique' }
  )
  .refine(rows => builtInFieldIdSchema.options.every(id => rows.flat().some(field => field.id === id)), {
    message: 'All built-in fields must be present'
  })

export const formSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  rows: formRowsSchema
})
export type FormSettings = z.infer<typeof formSettingsSchema>

export const getFormSettingsParamsSchema = formSettingsSchema.pick({ organizationId: true })
export type GetFormSettingsParams = z.infer<typeof getFormSettingsParamsSchema>

export const updateFormSettingsRequestSchema = formSettingsSchema.omit({ organizationId: true })
export type UpdateFormSettingsRequest = z.infer<typeof updateFormSettingsRequestSchema>

export const DEFAULT_FORM_ROWS: FormField[][] = [
  [{ builtIn: true, id: 'title', label: 'Title' }],
  [{ builtIn: true, id: 'description', label: 'Description' }],
  [{ builtIn: true, id: 'dueDate', label: 'Due date' }],
  [{ builtIn: true, id: 'priority', label: 'Priority' }],
  [{ builtIn: true, id: 'status', label: 'Status' }],
  [{ builtIn: true, id: 'tags', label: 'Tags' }]
]
