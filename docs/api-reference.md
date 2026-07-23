# API Reference

API documentation is generated from RestDocs snippets produced by contract tests.

::: info
The full interactive API reference is produced at build time from Spring REST Docs contract tests.
Run `./mvnw clean verify -pl broker` to generate the snippets, then browse the rendered docs at
`broker/target/generated-docs/`.
:::

## Authentication

All endpoints require HTTP Basic authentication. Three built-in roles are available:

| Role | Credentials | Permissions |
|------|-------------|-------------|
| `ADMIN` | `admin` / `admin` | Full access — read, write, delete |
| `PUBLISHER` | `publisher` / `publisher` | Read + write (no delete) |
| `READER` | `reader` / `reader` | Read only |

## Applications

### Register an application

`POST /api/v1/applications`

<!-- snippet content goes here -->

### Get an application

`GET /api/v1/applications/{name}`

<!-- snippet content goes here -->

### List applications

`GET /api/v1/applications`

Supports pagination via `page` and `size` query parameters. Results are sorted by `createdAt,desc` by default.

<!-- snippet content goes here -->

### Delete an application

`DELETE /api/v1/applications/{name}`

<!-- snippet content goes here -->

## Contracts

### Publish a contract

`POST /api/v1/applications/{name}/versions/{version}/contracts`

<!-- snippet content goes here -->

### Get a contract

`GET /api/v1/applications/{name}/versions/{version}/contracts/{contractName}`

<!-- snippet content goes here -->

### List contracts

`GET /api/v1/applications/{name}/versions/{version}/contracts`

<!-- snippet content goes here -->

## Verifications

### Record a verification

`POST /api/v1/verifications`

<!-- snippet content goes here -->

### List verifications

`GET /api/v1/verifications`

<!-- snippet content goes here -->

## Environments and Deployments

### Record a deployment

`POST /api/v1/environments/{env}/deployments`

<!-- snippet content goes here -->

### Get a deployment

`GET /api/v1/environments/{env}/deployments/{applicationName}`

<!-- snippet content goes here -->

### List deployments

`GET /api/v1/environments/{env}/deployments`

<!-- snippet content goes here -->

## Can I Deploy

### Check deployment safety

`GET /api/v1/can-i-deploy`

Query parameters: `application`, `version`, `environment`.

Returns `{"safe": true}` when all consumers currently deployed to the target environment have a passing verification against the requested version. Returns `{"safe": false}` with a list of blocking consumer versions otherwise.

<!-- snippet content goes here -->

## Tags

### Tag a version

`POST /api/v1/applications/{name}/versions/{version}/tags`

<!-- snippet content goes here -->

### List tags

`GET /api/v1/applications/{name}/tags`

<!-- snippet content goes here -->

## Webhooks

### Register a webhook

`POST /api/v1/webhooks`

<!-- snippet content goes here -->

### List webhooks

`GET /api/v1/webhooks`

<!-- snippet content goes here -->

### Delete a webhook

`DELETE /api/v1/webhooks/{id}`

<!-- snippet content goes here -->

## Dependency Graph

### Get the dependency graph

`GET /api/v1/graph`

Returns the full service dependency graph with verification status on each edge.

<!-- snippet content goes here -->

## Compatibility Matrix

### Get the compatibility matrix

`GET /api/v1/matrix`

Returns a matrix of consumer/provider version pairs with their verification statuses.

<!-- snippet content goes here -->
