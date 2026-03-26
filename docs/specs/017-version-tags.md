# Feature 17: Version Tags

## What

Version tags allow labeling application versions with human-readable labels such as
RELEASE, SNAPSHOT, RC, or custom names. Tags provide a stable reference to specific
versions and enable querying the latest version matching a particular tag. Tagged
versions are protected from automated data cleanup.

## Why

Without version tags, teams cannot:
- Mark a version as a release candidate or production release for reference
- Query the latest released version of a service without knowing the exact version number
- Protect important versions (releases, deployed versions) from automated cleanup
- Create stable references that pipelines and tools can use instead of hardcoded version strings

Version tags bridge the gap between mutable deployment concepts ("latest release") and
immutable version identifiers ("1.2.3").

## How (High Level)

Tags are managed as sub-resources of application versions. Adding a tag is idempotent:
re-adding an existing tag is a no-op. Tags can be removed individually. The latest
version matching a given tag can be queried, enabling stable references in CI/CD
pipelines. Tagged versions are excluded from automated data cleanup.

## API

```
PUT    /api/v1/applications/{name}/versions/{version}/tags/{tag}   -> 200 OK (add tag)
DELETE /api/v1/applications/{name}/versions/{version}/tags/{tag}   -> 204 No Content
GET    /api/v1/applications/{name}/versions/{version}/tags         -> 200 OK (list tags)
GET    /api/v1/applications/{name}/versions/latest?tag={tag}       -> 200 OK (latest by tag)
```

### Response: Add Tag

```json
{
    "applicationName": "order-service",
    "version": "1.2.0",
    "tag": "RELEASE",
    "createdAt": "2026-01-15T10:30:00Z"
}
```

### Response: List Tags

```json
{
    "applicationName": "order-service",
    "version": "1.2.0",
    "tags": [
        {
            "tag": "RELEASE",
            "createdAt": "2026-01-15T10:30:00Z"
        },
        {
            "tag": "STABLE",
            "createdAt": "2026-01-16T08:00:00Z"
        }
    ]
}
```

### Response: Latest by Tag

```json
{
    "applicationName": "order-service",
    "version": "1.2.0",
    "tags": ["RELEASE", "STABLE"],
    "contracts": 5,
    "createdAt": "2026-01-15T10:30:00Z"
}
```

## Business Rules

1. Tag names are case-sensitive strings containing only alphanumeric characters, hyphens, and underscores
2. Tag names must be between 1 and 50 characters
3. Adding a tag is idempotent: if the tag already exists on the version, the operation succeeds with no change
4. A version can have multiple tags
5. The same tag name can exist on different versions of the same application (e.g., moving "LATEST" from one version to another)
6. The `latest?tag={tag}` endpoint returns the most recently created version that has the specified tag
7. Tagged versions are protected from automated data cleanup (see Feature 18)
8. Removing a tag from a version does not affect the version or its contracts
9. Tags are metadata only; they do not change the behavior of verification or can-i-deploy checks

## Acceptance Criteria

### Add Tag to Version

**Given** application "order-service" exists with version "1.2.0"
**When** I PUT `/api/v1/applications/order-service/versions/1.2.0/tags/RELEASE`
**Then** I receive 200 OK
**And** the response shows tag "RELEASE" on version "1.2.0"

### Idempotent Tag Addition

**Given** version "1.2.0" of "order-service" already has tag "RELEASE"
**When** I PUT `/api/v1/applications/order-service/versions/1.2.0/tags/RELEASE`
**Then** I receive 200 OK
**And** no duplicate tag is created

### List Tags

**Given** version "1.2.0" of "order-service" has tags "RELEASE" and "STABLE"
**When** I GET `/api/v1/applications/order-service/versions/1.2.0/tags`
**Then** I receive 200 OK
**And** the response includes both "RELEASE" and "STABLE"

### Remove Tag

**Given** version "1.2.0" of "order-service" has tag "RC"
**When** I DELETE `/api/v1/applications/order-service/versions/1.2.0/tags/RC`
**Then** I receive 204 No Content
**And** the tag "RC" is no longer on version "1.2.0"

### Latest Version by Tag

**Given** "order-service" version "1.0.0" has tag "RELEASE" created at 10:00
**And** "order-service" version "1.2.0" has tag "RELEASE" created at 11:00
**When** I GET `/api/v1/applications/order-service/versions/latest?tag=RELEASE`
**Then** I receive 200 OK
**And** the response shows version "1.2.0"

### No Version with Tag

**Given** no version of "order-service" has tag "NIGHTLY"
**When** I GET `/api/v1/applications/order-service/versions/latest?tag=NIGHTLY`
**Then** I receive 404 Not Found

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Application not found | 404 | APPLICATION_NOT_FOUND |
| Version not found | 404 | VERSION_NOT_FOUND |
| Invalid tag name (special characters) | 400 | VALIDATION_ERROR |
| Tag name too long (>50 chars) | 400 | VALIDATION_ERROR |
| No version found for tag (latest query) | 404 | TAG_NOT_FOUND |
