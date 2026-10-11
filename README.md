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
   - container `FormSettings` with partition key `/organizationId`
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
| `npm test`      | Run the integration tests (see below)           |

## Tests

`npm test` runs integration tests that call the real HTTP endpoints, so the API and Cosmos must be running first.

1. Start the Cosmos DB Emulator and set up `local.settings.json` as described in [Run locally](#run-locally).
2. In one terminal, run `npm start`.
3. In another terminal, run `npm test`.

Each run uses a random `organizationId` and deletes the tasks it created, so it does not touch other data. To test an API that is not on `http://localhost:7071/api`, set `API_URL`:

```powershell
$env:API_URL = "https://example.com/api"
npm test
```

If the API is not reachable, the run stops immediately with a message saying so.

## API

Base path: `/api/organizations/{organizationId}/tasks`. `organizationId` and `id` must be UUIDs.

| Method | Route         | Description                      |
| ------ | ------------- | -------------------------------- |
| GET    | `/`           | List tasks (paginated)           |
| GET    | `/{id}`       | Get one task                     |
| POST   | `/`           | Create a task, the id is generated |
| PATCH  | `/{id}`       | Update fields of a task          |
| DELETE | `/{id}`       | Delete a task                    |
| DELETE | `/`           | Bulk delete, body is an id array |

A task has a server-generated `id` (uuid), `title` (max 100), `status` (`todo`, `in-progress`, `completed`) and the optional `description`, `dueDate` (ISO 8601 in UTC, e.g. `2026-10-11T10:00:00Z`), `priority` (`low`, `medium`, `high`) and `tags`. The full shape is in [task.schema.json](task.schema.json).

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

### Custom field values

Tasks can carry values for the custom fields in the form settings, in `customFields`, an object keyed by the custom field id:

```json
{ "title": "Call back", "status": "todo", "customFields": { "<field id>": "555-0100" } }
```

- Values are strings, validated on create and update against the field type: `text` any string, `email` an email address, `date` as `YYYY-MM-DD`, `datetime` as ISO 8601 in UTC (ending in `Z`). A bad value returns `400`.
- Keys that are not custom fields in the current settings are ignored and not stored.
- On update, `customFields` replaces the whole object, so send every value to keep.
- Deleting a custom field from the settings leaves its stored values on existing tasks. They are still returned and are harmless.

### Form settings

The form layout is stored once per organization and applies to all its tasks.

| Method | Route                                         | Description                                     |
| ------ | --------------------------------------------- | ----------------------------------------------- |
| GET    | `/organizations/{organizationId}/form-settings` | Get the settings, or the defaults if none saved |
| PUT    | `/organizations/{organizationId}/form-settings` | Replace the settings                            |
| DELETE | `/organizations/{organizationId}/form-settings` | Reset to the defaults                           |

The body of `PUT` and the `rows` of the response are rows of 1 or 2 fields:

```json
{
  "rows": [
    [{ "builtIn": true, "id": "title", "label": "Title" }],
    [
      { "builtIn": true, "id": "status", "label": "State" },
      { "builtIn": false, "id": "<uuid>", "label": "Phone", "type": "text" }
    ]
  ]
}
```

- If a built-in field is missing from the saved settings, `GET` appends it as its own row at the end.
- Built-in fields (`title`, `description`, `dueDate`, `priority`, `status`, `tags`) must all be present. Only their label and position can change.
- Custom fields have a uuid `id` and a `type` of `text`, `date`, `datetime` or `email`.
- `label` is 1 to 50 characters. Field ids must be unique. There is no limit on the number of rows.

### Errors

Invalid input returns `400` with `{ "error": "...", "issues": [{ "path": "...", "message": "..." }] }`. A missing task returns `404`.
