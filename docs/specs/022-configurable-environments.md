# Feature 22: Configurable Environments

## What

A master list of environments that the broker knows about, replacing the current approach where environment names are free-form strings.
Environments are first-class entities with metadata (description, display order, production flag).

## Why

- The UI currently hardcodes `["dev", "staging", "production"]` — this is inflexible
- Users need to define custom environments (e.g., `qa`, `perf`, `canary`, `us-east-1-prod`)
- The "production" flag enables the broker to apply stricter can-i-deploy checks for production environments
- Display order controls how environments appear in the UI

## Who

- **Administrators** create and configure environments via API or UI
- **CI/CD pipelines** benefit from auto-created environments when recording deployments
- **UI users** see a dynamic, accurate list of environments instead of a hardcoded array

## How It Works

1. Environments are stored in an `environments` table with CRUD operations
2. When a deployment is recorded for an unknown environment, the environment is auto-created
3. The V10 migration seeds the environments table from existing `SELECT DISTINCT environment FROM deployments`
4. The UI fetches the environment list dynamically instead of using hardcoded values

## API Endpoints

```
GET    /api/v1/environments                -> 200 (list, ordered by displayOrder then name)
POST   /api/v1/environments                -> 201 + Location
GET    /api/v1/environments/{name}         -> 200
PUT    /api/v1/environments/{name}         -> 200
DELETE /api/v1/environments/{name}         -> 204
```

### Create/Update Request

```json
{
  "name": "staging",
  "description": "Pre-production environment",
  "displayOrder": 2,
  "production": false
}
```

### Response

```json
{
  "name": "staging",
  "description": "Pre-production environment",
  "displayOrder": 2,
  "production": false,
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:00:00Z"
}
```

## Business Rules

- Environment name: lowercase alphanumeric and hyphens, 1-64 characters
- Name is unique and immutable (cannot rename — delete and recreate)
- `displayOrder` defaults to 0; environments with same order are sorted alphabetically
- `production` defaults to false
- Deleting an environment does NOT delete its deployments (deployments are historical)
- Auto-create on deploy: when `DeploymentService.recordDeployment()` encounters an unknown environment, it calls `EnvironmentService.ensureExists(name)` which creates a minimal entry

## Security

- `GET /api/v1/environments` — READER role (or higher)
- `POST/PUT/DELETE /api/v1/environments` — ADMIN role only

## Error Cases

- Environment not found: 404 with `ENVIRONMENT_NOT_FOUND`
- Environment already exists (on create): 409 with `ENVIRONMENT_ALREADY_EXISTS`
- Invalid name format: 400 with `VALIDATION_ERROR`

## Acceptance Criteria

- Given no environments exist
  When the V10 migration runs and deployments exist for "dev", "staging", "production"
  Then three environments are created with those names

- Given an admin user
  When they create an environment named "canary" with production=false
  Then 201 is returned with the environment details

- Given environment "canary" exists
  When they try to create another environment named "canary"
  Then 409 Conflict is returned

- Given environments ["dev", "staging", "production"]
  When listing environments
  Then they are returned ordered by displayOrder, then name

- Given no environment "perf" exists
  When a deployment is recorded to "perf"
  Then the environment "perf" is auto-created and the deployment succeeds

- Given environment "old-env" exists
  When an admin deletes it
  Then 204 is returned and it no longer appears in listings
  But existing deployments to "old-env" remain in the database
