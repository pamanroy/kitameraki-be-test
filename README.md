# kitameraki-be-test

Task management API built with Azure Functions (Node.js, TypeScript) and Azure Cosmos DB.

## Prerequisites

- Node.js 20 or later
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4
- [Azure Cosmos DB Emulator](https://learn.microsoft.com/azure/cosmos-db/emulator)

Install Core Tools on Windows with winget:

```powershell
winget install Microsoft.Azure.FunctionsCoreTools
```

## Run locally

1. Start the Cosmos DB Emulator. It listens on `https://localhost:8081`.
2. In the emulator's Data Explorer (`https://localhost:8081/_explorer/index.html`), create:
   - database `TaskApp`
   - container `Tasks` with partition key `/organizationId`
3. Create `local.settings.json` in the project root. It is gitignored.

   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "NODE_TLS_REJECT_UNAUTHORIZED": "0",
       "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://localhost:8081/;AccountKey=<emulator key>"
     }
   }
   ```

   `<emulator key>` is the primary key shown on the emulator's start page and in its Data Explorer. `NODE_TLS_REJECT_UNAUTHORIZED=0` lets Node accept the emulator's self-signed certificate, so use it only locally.

4. Install and start:

   ```powershell
   npm install
   npm start
   ```

   `npm start` cleans, builds and runs `func start`. The API is served at `http://localhost:7071/api`.

For development, run `npm run watch` in a second terminal. It recompiles on change and rewrites the `~` imports.

## Scripts

| Script          | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `npm start`     | Clean, build and start the Functions host       |
| `npm run build` | Compile with `tsc` and resolve `~` path aliases |
| `npm run watch` | Rebuild on change                               |
| `npm run clean` | Remove `dist`                                   |

## API

Base path: `/api/organizations/{organizationId}/tasks`. `organizationId` and `id` must be UUIDs.

| Method | Route         | Description                      |
| ------ | ------------- | -------------------------------- |
| GET    | `/`           | List tasks (paginated)           |
| GET    | `/{id}`       | Get one task                     |
| POST   | `/`           | Create a task                    |
| PATCH  | `/{id}`       | Update fields of a task          |
| DELETE | `/{id}`       | Delete a task                    |
| DELETE | `/`           | Bulk delete, body is an id array |

A task has `id`, `title` (max 100), `status` (`todo`, `in-progress`, `completed`) and the optional `description`, `dueDate` (ISO 8601 with offset), `priority` (`low`, `medium`, `high`) and `tags`. The full shape is in [task.schema.json](task.schema.json).

### Listing tasks

`GET /organizations/{organizationId}/tasks`

| Query      | Default | Description                                         |
| ---------- | ------- | --------------------------------------------------- |
| `page`     | 1       | Page number, starting at 1                          |
| `pageSize` | 20      | Items per page, 1 to 100                            |
| `status`   |         | Filter by status                                    |
| `priority` |         | Filter by priority                                  |
| `tag`      |         | Filter to tasks containing this exact tag           |
| `q`        |         | Case-insensitive substring search on title and description |

Response:

```json
{ "items": [], "page": 1, "pageSize": 20, "total": 0 }
```

Results are ordered newest first. Pagination uses `OFFSET`/`LIMIT`, which suits page-numbered UIs but costs more on very deep pages. Switching to Cosmos continuation tokens would scale better but drops page numbers and `total`.

### Errors

Invalid input returns `400` with `{ "error": "...", "issues": [{ "path": "...", "message": "..." }] }`. A missing task returns `404` and a duplicate id returns `409`.
