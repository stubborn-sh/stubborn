# Application Registration

An Application in Stubborn Broker represents a named service — either a producer that
publishes contracts or a consumer that verifies them. Every application must be registered
before its contracts or verification results can be published.


## Automatic registration via plugins

The Maven and Gradle plugins register an application automatically on the first publish. No
manual API call is needed for typical workflows. The plugin sends a registration request
before uploading contracts or recording verification results; if the application already
exists the broker skips the creation step.

### Maven plugin

```xml
<plugin>
  <groupId>sh.stubborn</groupId>
  <artifactId>stubborn-contract-maven-plugin</artifactId>
  <configuration>
    <brokerUrl>http://localhost:8080</brokerUrl>
    <applicationName>my-service</applicationName>
  </configuration>
</plugin>
```

Call the publish goal and the plugin handles registration first:

```bash
./mvnw stubborn:publish
```

## API

Use the REST API directly when you need to pre-register an application, set optional
metadata such as a repository URL or main branch, or automate registration from a script.

### Register an application

```
POST /api/v1/applications
```

**Request body**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique application name. Alphanumeric and hyphens; no leading/trailing hyphens; 2-128 characters. |
| `description` | no | Human-readable description, max 1000 characters. |
| `owner` | yes | Team or person responsible for the application, max 100 characters. |
| `repositoryUrl` | no | URL of the source repository. |
| `mainBranch` | no | Default branch name (e.g. `main`). |

**Example**

```bash
curl -s -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "name": "order-service",
    "description": "Manages order lifecycle",
    "owner": "team-commerce",
    "repositoryUrl": "https://github.com/example/order-service",
    "mainBranch": "main"
  }'
```

**201 Created response**

```json
{
  "name": "order-service",
  "description": "Manages order lifecycle",
  "owner": "team-commerce",
  "repositoryUrl": "https://github.com/example/order-service",
  "mainBranch": "main",
  "createdAt": "2026-07-23T09:15:00Z"
}
```

The `Location` response header points to the new resource:

```
Location: /api/v1/applications/order-service
```

### List all applications

```
GET /api/v1/applications
```

Returns a paginated list of all registered applications.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | — | Case-insensitive filter on application name |
| `page` | int | `0` | Zero-indexed page number |
| `size` | int | `20` | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

**Example**

```bash
curl -s "http://localhost:8080/api/v1/applications?search=order&page=0&size=20"
```

### Get an application by name

```
GET /api/v1/applications/{name}
```

**Example**

```bash
curl -s http://localhost:8080/api/v1/applications/order-service
```

Returns `200 OK` with the application details, or `404 Not Found` if no application with
that name exists.

### Delete an application

```
DELETE /api/v1/applications/{name}
```

Requires the `ADMIN` role. Returns `204 No Content` on success. Deletion is rejected with
`409 Conflict` if the application has published contracts or active deployments.

**Example**

```bash
curl -s -X DELETE http://localhost:8080/api/v1/applications/order-service
```

## Error reference

| Scenario | HTTP status | Error code |
|----------|-------------|------------|
| Duplicate name | 409 | `APPLICATION_ALREADY_EXISTS` |
| Invalid name format | 400 | `VALIDATION_ERROR` |
| Name too long (>128 chars) | 400 | `VALIDATION_ERROR` |
| Missing required fields | 400 | `VALIDATION_ERROR` |
| Application not found | 404 | `APPLICATION_NOT_FOUND` |
| Delete with existing contracts | 409 | `APPLICATION_HAS_CONTRACTS` |
