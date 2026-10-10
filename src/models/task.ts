export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'in-progress' | 'completed'

export interface Task {
  id: string
  organizationId: string
  title: string
  description?: string
  dueDate?: string
  priority?: TaskPriority
  status: TaskStatus
  tags?: string[]
}

export const EDITABLE_TASK_FIELDS = ['title', 'description', 'dueDate', 'priority', 'status', 'tags'] as const

export type GetTaskParams = Pick<Task, 'organizationId' | 'id'>

export type GetTasksParams = Pick<Task, 'organizationId'>

// organizationId comes from the route, not the body
export type CreateTaskRequest = Omit<Task, 'organizationId'>

export type UpdateTaskRequest = Partial<Pick<Task, (typeof EDITABLE_TASK_FIELDS)[number]>>

export type DeleteTaskRequest = Pick<Task, 'organizationId' | 'id'>

export type BulkDeleteTasksRequest = string[]
