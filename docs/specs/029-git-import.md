# 029 - Git Repository Import

## What

Import contracts directly from Git repositories into the Stubborn broker, extracting contract files from a configurable directory within the repository.

## Why

Many teams store contracts alongside their source code in Git repositories. Requiring them to first publish a Maven artifact creates unnecessary friction. Direct Git import enables a simpler workflow: push contracts to Git, import them into the broker.

## How

A new vertical slice `sh.stubborn.oss.gitimport` provides:
- JGit-based shallow clone (depth=1) of the target repository
- Extraction of contract files (`.yaml`, `.yml`, `.json`, `.groovy`) from a configurable directory
- Version detection: Git tag on HEAD (if present) or abbreviated commit SHA (7 chars), with caller override
- Authentication: NONE (public repos), HTTPS_TOKEN, HTTPS_BASIC
- Circuit breaker protection for clone operations (60s slow-call threshold)
- Source registration for future sync support

## API

### On-demand Import
```
POST /api/v1/import/git
{
  "applicationName": "order-service",
  "repositoryUrl": "https://github.com/example/order-service.git",
  "branch": "main",
  "contractsDirectory": "src/test/resources/contracts/",
  "version": "1.0.0",           // optional, overrides auto-detection
  "authType": "NONE",           // NONE | HTTPS_TOKEN | HTTPS_BASIC
  "username": null,
  "token": null
}
```

Response:
```json
{ "published": 3, "skipped": 1, "total": 4, "resolvedVersion": "v1.0.0" }
```

### Source Registration
```
POST /api/v1/import/git-sources
{
  "applicationName": "order-service",
  "repositoryUrl": "https://github.com/example/order-service.git",
  "branch": "main",
  "contractsDirectory": "src/test/resources/contracts/",
  "authType": "NONE",
  "username": null,
  "encryptedToken": null,
  "syncEnabled": false
}
```

### List Sources
```
GET /api/v1/import/git-sources
```

### Get Source
```
GET /api/v1/import/git-sources/{id}
```

### Delete Source
```
DELETE /api/v1/import/git-sources/{id}
```

## Business Rules

1. Only `https://` and `http://` URL schemes are allowed. `file://` is rejected.
2. Shallow clone (depth=1) to minimize bandwidth and disk usage.
3. Temp directory is always cleaned up in a finally block.
4. Contract files: `.yaml`, `.yml`, `.json`, `.groovy` extensions only.
5. Version resolution order: caller-provided version > Git tag on HEAD > abbreviated commit SHA.
6. Max single file size: 1 MB.
7. Source registration enforces uniqueness on (repository_url, application_name).

## Acceptance Criteria

### Import from Public Repository
- **Given** a public Git repository with contracts in `src/test/resources/contracts/`
- **When** I POST to `/api/v1/import/git` with the repository URL and application name
- **Then** contracts are extracted and published to the broker
- **And** the response contains published/skipped/total counts and resolved version

### Import with Version Override
- **Given** a Git repository with contracts
- **When** I POST with a `version` field set to `2.0.0`
- **Then** all contracts are published with version `2.0.0`

### Import with Token Authentication
- **Given** a private Git repository requiring authentication
- **When** I POST with `authType: HTTPS_TOKEN` and a valid token
- **Then** the repository is cloned and contracts are imported

### Reject Invalid URL Scheme
- **Given** a request with `repositoryUrl` using `file://` scheme
- **When** I POST to `/api/v1/import/git`
- **Then** the request is rejected with 400 Bad Request

### Source Registration
- **Given** no existing source for a repository/application combination
- **When** I POST to `/api/v1/import/git-sources`
- **Then** a source is created and returned with 201 Created

### Duplicate Source Rejection
- **Given** a source already registered for the same repository and application
- **When** I POST to `/api/v1/import/git-sources` with the same combination
- **Then** the request is rejected with 400 Bad Request

### Source CRUD
- **Given** registered sources
- **When** I GET, LIST, or DELETE sources
- **Then** standard CRUD operations work as expected

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Invalid URL scheme (file://) | 400 | GIT_IMPORT_ERROR |
| Clone failure (auth, network) | 400 | GIT_IMPORT_ERROR |
| No contracts found | 400 | GIT_IMPORT_ERROR |
| Source not found | 404 | GIT_IMPORT_SOURCE_NOT_FOUND |
| Duplicate source | 400 | GIT_IMPORT_ERROR |
| Circuit breaker open | 503 | SERVICE_UNAVAILABLE |
| Missing required fields | 400 | VALIDATION_ERROR |
