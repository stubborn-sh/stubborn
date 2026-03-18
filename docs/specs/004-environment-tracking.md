# Feature 4: Environment Tracking

## What

Track which version of an application is deployed to which environment (e.g., staging, production).
This enables the "Can I Deploy" check (Feature 5) by knowing what's currently running where.

## Why

- Know which version of each service is deployed in each environment
- Enable "Can I Deploy" decisions based on what's actually running
- Provide visibility into the deployment state across environments

## Who

- **CI/CD pipelines** record deployments after successful deploy
- **Operators** query current deployment state
- **Can I Deploy** (Feature 5) uses this data for safety checks

## How It Works

1. After deploying an application version, the pipeline records the deployment
2. Each environment has at most one version per application (latest deploy wins)
3. Recording a new deployment for the same app+environment updates the version
4. Environments and deployments can be queried

## API Endpoints

```
POST   /api/v1/environments/{env}/deployments                   -> 201 + Location
GET    /api/v1/environments/{env}/deployments                   -> 200 (paginated)
GET    /api/v1/environments/{env}/deployments/{applicationName} -> 200
```

### Query Parameters (List)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 0 | Zero-indexed page number |
| `size` | int | 20 | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

## Business Rules

- Application must exist (registered via Feature 1)
- Environment name follows pattern: lowercase alphanumeric and hyphens, 1-64 chars
- Version follows semantic versioning
- At most one deployment record per application per environment (upsert)
- Recording a deployment for an app already in the environment updates the version

## Error Cases

- Application not found: 404 with `APPLICATION_NOT_FOUND`
- Invalid environment name: 400 with `VALIDATION_ERROR`
- Invalid version format: 400 with `VALIDATION_ERROR`
- Deployment not found: 404 with `DEPLOYMENT_NOT_FOUND`

## Acceptance Criteria

- Given a registered application "order-service"
  When I record a deployment of version "1.0.0" to environment "staging"
  Then I receive 201 Created

- Given "order-service" v1.0.0 deployed to "staging"
  When I record a deployment of version "2.0.0" to "staging"
  Then the staging deployment is updated to v2.0.0

- Given deployments in "production"
  When I list deployments for "production"
  Then I see all currently deployed applications and their versions
