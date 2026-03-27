# Spec 034 — Maven Import UI

## What

A browser-based UI for managing Maven stub imports: discovering stubs from remote repositories (Nexus, Artifactory, Maven Central), importing individual JARs, and managing registered import sources with sync scheduling.

## Why

CLI and API-only workflows create friction for teams onboarding to Stubborn. A visual interface lowers the barrier, allows browsing discovered stubs before importing, and gives operators a single pane of glass for managing recurring Maven import sources.

## How

- **Discover page** — Form to enter repository URL and type; calls `POST /api/v1/import/maven-discover`. Results are displayed in a table with one-click import buttons.
- **Import JAR page** — Form for one-shot JAR import (`POST /api/v1/import/maven-jar`). Shows published/skipped/total counts on completion.
- **Sources management** — CRUD table backed by `/api/v1/import/sources`. Toggle sync on/off per source. Pagination via Spring Data `Pageable`.
- **Credentials** — Username/password fields for authenticated repositories; values are sent to the backend over HTTPS and never stored in the browser.
- Reuses the existing Thymeleaf + HTMX patterns from the core broker UI (spec 020).
