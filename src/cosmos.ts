import { Container, CosmosClient } from '@azure/cosmos'

const DATABASE_ID = 'TaskApp'
const TASKS_CONTAINER_ID = 'Tasks'
const FORM_SETTINGS_CONTAINER_ID = 'FormSettings'

const connectionString = process.env.COSMOS_CONNECTION_STRING
if (!connectionString) {
  throw new Error('COSMOS_CONNECTION_STRING is not set')
}

const database = new CosmosClient(connectionString).database(DATABASE_ID)

export const tasksContainer: Container = database.container(TASKS_CONTAINER_ID)
export const formSettingsContainer: Container = database.container(FORM_SETTINGS_CONTAINER_ID)
