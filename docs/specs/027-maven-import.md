# Feature 27: Broker Maven Import

## What

A new broker vertical slice (`mavenimport`) that imports existing stubs JARs from Maven
repositories (Nexus/Artifactory) into the broker's contract database. This lets teams
adopt the broker incrementally — importing their existing stubs JARs without re-publishing
every contract through the REST API.

## Why

Teams that have used Spring Cloud Contract for years have stubs JARs in Nexus/Artifactory.
Currently, migrating to the broker requires re-publishing every contract version. Maven
import provides a one-click migration path and optional ongoing sync.

## How (High Level)

### One-Time Import

`POST /api/v1/import/maven-jar` downloads a stubs JAR from a Maven repository, extracts
contracts and WireMock mappings, and publishes each one to the broker via the existing
`ContractService.publish()`. Content hash dedup makes re-importing safe (idempotent).

### Import Source Registration

`POST /api/v1/import/sources` registers a Maven repository + coordinates for tracking.
Future: `@Scheduled` sync checks for new versions via `maven-metadata.xml`.

## REST API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/import/maven-jar` | One-time import by coordinates |
| GET | `/api/v1/import/sources` | List registered import sources |
| POST | `/api/v1/import/sources` | Register a sync source |
| GET | `/api/v1/import/sources/{id}` | Get source details |
| DELETE | `/api/v1/import/sources/{id}` | Remove a source |

## Database

`V11__create_maven_import_sources.sql` creates:
- `maven_import_sources` table for tracking registered repositories
- Unique index on `(repository_url, group_id, artifact_id)`
- Partial index on `sync_enabled = TRUE` for scheduled sync

## Acceptance Criteria

- **Given** a stubs JAR at `https://nexus.example.com/.../order-service-1.0.0-stubs.jar`
  **When** `POST /api/v1/import/maven-jar` is called with coordinates
  **Then** contracts from the JAR are published to the broker under the application name

- **Given** a stubs JAR with `META-INF/.../mappings/*.json` (WireMock format)
  **When** the JAR is imported
  **Then** each JSON mapping is stored as `application/json` content type

- **Given** a stubs JAR with `META-INF/.../contracts/*.yaml` (SCC format)
  **When** the JAR is imported
  **Then** each YAML contract is stored as `application/x-yaml` content type

- **Given** a duplicate import (same contracts already published)
  **When** `POST /api/v1/import/maven-jar` is called again
  **Then** duplicates are skipped (idempotent) and the result reports `skipped` count

- **Given** a registered import source
  **When** `DELETE /api/v1/import/sources/{id}` is called
  **Then** the source is removed (does not delete imported contracts)

## Error Cases

- Application not registered → 404 from `ApplicationService.findIdByName`
- Maven repository unreachable → `MavenImportException` with URL details
- Empty stubs JAR (no contracts) → `MavenImportException`
- JAR exceeds 50 MB → `MavenImportException`
- Individual entry exceeds 1 MB → Skipped with warning log
- Invalid URL scheme (not http/https) → `MavenImportException`
- Duplicate source registration → `MavenImportException`
- Source not found for GET/DELETE → `MavenImportSourceNotFoundException`

## Security

- URL scheme validation (http/https only) prevents SSRF via `file://` or `ftp://`
- JAR size limited to 50 MB, individual entries to 1 MB
- Zip entries validated for contract-relevant paths only (`mappings/`, `contracts/`)
- Credentials encrypted at rest (field: `encrypted_password`)
- `ADMIN` or `PUBLISHER` role required for POST/DELETE (inherited from SecurityConfig)
- `READER` role sufficient for GET (inherited from SecurityConfig)
