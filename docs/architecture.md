# Architecture

## Multi-Module Structure

The project is organized as a multi-module Maven reactor.
Run `ls -d */` from the project root or check `pom.xml` `<modules>` for the current list.

Key modules:

* **broker** — core REST API, database, UI static resources, stubs JAR assembly
* **ui** — React frontend (Vite + TailwindCSS + React Query)
* **broker-api-client** — generated REST client JAR from `spec/contracts/broker-api.yaml`
* **broker-stub-downloader** — `StubDownloaderBuilder` SPI for the `sccbroker://` protocol
* **broker-contract-publisher** — Java library for scanning and publishing contracts
* **broker-maven-plugin** / **broker-gradle-plugin** — build tool plugins wrapping the publisher
* **stub-runner** — Stub Runner Boot for consumer testing
* **stubborn-messaging-kafka** — Kafka messaging support
* **stubborn-messaging-rabbit** — RabbitMQ messaging support
* **e2e-tests** — Playwright browser-based E2E tests
* **js/** — Node.js packages (CLI, stub-server, stubs-packager, Jest integration)

```mermaid
graph TD
    subgraph OSS["stubborn-sh/stubborn (OSS)"]
        UI[ui\nReact + Vite]
        Broker[broker\nSpring Boot REST API]
        Client[broker-api-client\nGenerated REST client]
        Publisher[broker-contract-publisher\nContract scanner]
        Maven[broker-maven-plugin]
        Gradle[broker-gradle-plugin]
        StubDL[broker-stub-downloader\nsccbroker:// protocol]
        SR[stub-runner\nStub Runner Boot]
        JS[js/\n@stubborn-sh/cli & jest]
    end

    subgraph PRO["stubborn-sh/stubborn-pro (PRO)"]
        MCP[broker-mcp-server\nMCP Server]
        Proxy[proxy\nAI Traffic Proxy]
        CLI[broker-cli\nJava Picocli CLI]
    end

    UI --> Broker
    Maven --> Publisher
    Gradle --> Publisher
    Publisher --> Broker
    StubDL --> Broker
    SR --> StubDL
    MCP --> Client
    CLI --> Client
    Client --> Broker
```

## Broker Module — Vertical Slice Architecture

The broker module is organized by feature (vertical slices), not by technical layer.
Each package under `broker/src/main/java/sh/stubborn/oss/` is a self-contained feature
with its own controller, DTOs, entity, repository, and service.

This structure is enforced by `ArchitectureTest.java` (ArchUnit) — controllers cannot access
repositories directly, services cannot depend on controllers, and entities must be package-private.

## Proxy Module

Independent Spring Boot app (`proxy/`) with Spring AI ChatClient for AI traffic-to-contract generation.

## UI Module — Feature-Sliced Architecture

```
ui/src/
├── api/             # Typed fetch client + TypeScript types
├── features/        # Feature slices (applications, contracts, verifications, etc.)
├── shared/          # Shared components (Layout, DataTable, ComboBox, SearchInput, etc.)
├── App.tsx
└── main.tsx
```

### Shared Components

* **DataTable** — Generic table with server-side pagination (page/size controls, page navigation).
  Client-side column sorting is disabled when server-side pagination is active to avoid misleading partial-page sorts.
* **ComboBox** — Searchable dropdown replacing plain `<select>` for application and version pickers.
  Supports keyboard navigation (Arrow Up/Down, Enter, Escape) and ARIA attributes (`aria-expanded`, `aria-activedescendant`).
* **SearchInput** — Debounced text input with `useDeferredValue` for server-side search filtering.

### Data Fetching

All list pages use TanStack React Query with `keepPreviousData` to eliminate loading flash during pagination.
Search resets to page 0. The API client passes `sort=createdAt,desc` by default so newest entries appear first.

## Publishing Plugins

The broker provides two plugins for publishing contracts from producer builds:

- **broker-maven-plugin** — Maven Mojo wrapping `broker-contract-publisher`
- **broker-gradle-plugin** — Gradle plugin wrapping `broker-contract-publisher`

Both scan the build output for contract files and push them to the broker REST API.

## Stub Downloader

The `broker-stub-downloader` module implements the Stubborn Contract `StubDownloaderBuilder` SPI.
Consumers add it as a test dependency and configure `@AutoConfigureStubRunner` with the `sccbroker://` protocol
to fetch contracts and stubs from the broker API.

## API Client

The `broker-api-client` module is a generated REST client JAR produced from `spec/contracts/broker-api.yaml`
using OpenAPI Generator with the `restclient` library.

## CLI (PRO)

The Picocli-based Java CLI (`broker-cli`) is available in [Stubborn Pro](https://stubborn.sh/pro). The OSS project includes a Node.js CLI — see [CLI docs](/features/cli).

## MCP Server (PRO)

The MCP server (`broker-mcp-server`) is available in [Stubborn Pro](https://stubborn.sh/pro). See [MCP Server docs](/features/mcp-server).
