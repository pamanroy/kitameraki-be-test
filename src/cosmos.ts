import { Container, CosmosClient } from '@azure/cosmos'

const DATABASE_ID = 'TaskApp'
const TASKS_CONTAINER_ID = 'Tasks'

let tasksContainer: Container | undefined

export function getTasksContainer(): Container {
  if (!tasksContainer) {
    const connectionString = process.env.COSMOS_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING is not set')
    }
    tasksContainer = new CosmosClient(connectionString).database(DATABASE_ID).container(TASKS_CONTAINER_ID)
  }
  return tasksContainer
}
