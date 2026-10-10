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

export type GetTaskParams = Pick<Task, 'organizationId' | 'id'>
export type GetTasksParams = Pick<Task, 'organizationId'>

export const createTaskRequestSchema = taskSchema.omit({ organizationId: true })
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>

export const updateTaskRequestSchema = taskSchema.omit({ id: true, organizationId: true }).partial()
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>

export type DeleteTaskRequest = Pick<Task, 'organizationId' | 'id'>

export const bulkDeleteTasksRequestSchema = z.array(taskSchema.shape.id)
export type BulkDeleteTasksRequest = z.infer<typeof bulkDeleteTasksRequestSchema>
