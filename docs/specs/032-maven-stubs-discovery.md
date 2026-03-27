# Feature 32: Maven Stubs Discovery

## What

Auto-discovery of stubs JARs from Maven repositories (Nexus 3, Artifactory, Maven Central).
A new endpoint `POST /api/v1/import/maven-discover` accepts a repository URL and type, queries
the repository's search API for artifacts with classifier `stubs`, and returns the discovered
groupId:artifactId pairs with their latest versions.

## Why

Teams migrating to Stubborn from Spring Cloud Contract often have hundreds of stubs JARs spread
across Nexus or Artifactory. Manual registration of each artifact is tedious and error-prone.
Discovery lets users find all stubs JARs in a repository with a single API call, then selectively
import the ones they need.

## How (High Level)

### Repository Search APIs

Each repository type has a different search API:

| Repository | Search Endpoint | Key Parameters |
|------------|----------------|----------------|
| Nexus 3 | `GET {repoUrl}/service/rest/v1/search` | `maven.classifier=stubs&maven.extension=jar` |
| Artifactory | `GET {repoUrl}/api/search/gavc` | `c=stubs&repos=*` |
| Maven Central | `GET https://search.maven.org/solrsearch/select` | `q=c:stubs&rows=50&wt=json` |

### Flow

1. User calls `POST /api/v1/import/maven-discover` with repository URL, type, and optional credentials
2. `MavenStubsDiscoveryService` queries the appropriate search API
3. Response is parsed into `DiscoveredStub` records (groupId, artifactId, latestVersion)
4. List of discovered stubs is returned to the caller

## REST API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/import/maven-discover` | Discover stubs JARs in a Maven repository |

### Request Body

```json
{
  "repositoryUrl": "https://nexus.example.com/repository/maven-releases",
  "repositoryType": "NEXUS",
  "username": "optional-user",
  "password": "optional-pass"
}
```

### Response Body

```json
{
  "stubs": [
    {
      "groupId": "com.example",
      "artifactId": "order-service",
      "latestVersion": "2.1.0"
    }
  ]
}
```

## Acceptance Criteria

- **Given** a Nexus 3 repository with stubs JARs
  **When** `POST /api/v1/import/maven-discover` is called with type `NEXUS`
  **Then** the response contains all discovered groupId:artifactId pairs with latest versions

- **Given** an Artifactory repository with stubs JARs
  **When** `POST /api/v1/import/maven-discover` is called with type `ARTIFACTORY`
  **Then** the response contains all discovered groupId:artifactId pairs with latest versions

- **Given** Maven Central
  **When** `POST /api/v1/import/maven-discover` is called with type `CENTRAL`
  **Then** the response contains all discovered groupId:artifactId pairs with latest versions

- **Given** a repository requiring authentication
  **When** credentials are provided in the request
  **Then** the search API is called with Basic auth headers

- **Given** an unreachable repository
  **When** discovery is attempted
  **Then** a `MavenImportException` is thrown with descriptive error

## Error Cases

- Repository unreachable -> `MavenImportException` with URL details
- Invalid repository type -> 400 Bad Request (validation)
- Authentication failure -> `MavenImportException` wrapping 401/403
- Empty results -> returns empty list (not an error)

## Security

- URL scheme validation (http/https only) prevents SSRF
- Credentials passed via request body, not stored
- `ADMIN` or `PUBLISHER` role required (inherited from SecurityConfig)
- Circuit breaker protects against slow/unresponsive repositories
