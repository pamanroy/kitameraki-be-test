import { z } from 'zod'

export const taskSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    title: z.string().max(100),
    description: z.string().max(1000).optional(),
    dueDate: z.string().datetime({ offset: true }).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    status: z.enum(['todo', 'in-progress', 'completed']),
    tags: z.array(z.string().max(50)).optional()
  })
  .strict()
export type Task = z.infer<typeof taskSchema>

// use zod pick instead of ts pick to validate the id is uuid
export const getTaskParamsSchema = taskSchema.pick({ organizationId: true, id: true })
export type GetTaskParams = z.infer<typeof getTaskParamsSchema>

export const getTasksParamsSchema = taskSchema.pick({ organizationId: true })
export type GetTasksParams = z.infer<typeof getTasksParamsSchema>

export const getTasksQuerySchema = z.object({
  // coerce converts the value to a number before validation
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: taskSchema.shape.status.optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tag: z.string().max(50).optional(),
  q: z.string().trim().min(1).max(100).optional()
})
export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>

export const createTaskRequestSchema = taskSchema.omit({ organizationId: true })
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>

export const updateTaskRequestSchema = taskSchema
  .omit({ id: true, organizationId: true })
  .partial()
  // add custom validation rule
  .refine(body => Object.keys(body).length > 0, { message: 'At least one field must be provided' })
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>

export const deleteTaskRequestSchema = getTaskParamsSchema
export type DeleteTaskRequest = GetTaskParams

export const bulkDeleteTasksRequestSchema = z.array(taskSchema.shape.id)
export type BulkDeleteTasksRequest = z.infer<typeof bulkDeleteTasksRequestSchema>
