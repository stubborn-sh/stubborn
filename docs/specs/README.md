# Feature Specifications

## Business Features

| # | Feature | Spec | Status |
|---|---------|------|--------|
| 1 | Application Registration | [001-application-registration.md](001-application-registration.md) | Done |
| 2 | Contract Publishing | [002-contract-publishing.md](002-contract-publishing.md) | Done |
| 3 | Verification Results | [003-verification-results.md](003-verification-results.md) | Done |
| 4 | Environment Tracking | [004-environment-tracking.md](004-environment-tracking.md) | Done |
| 5 | Can I Deploy | [005-can-i-deploy.md](005-can-i-deploy.md) | Done |
| 6 | Security | [006-security.md](006-security.md) | Done |
| 7 | AI Traffic-to-Contract Proxy | [007-ai-traffic-proxy.md](007-ai-traffic-proxy.md) | Done |
| 8 | Contract Publishing Plugins | [008-contract-publishing-plugins.md](008-contract-publishing-plugins.md) | Planned |
| 9 | Dependency Graph | [009-dependency-graph.md](009-dependency-graph.md) | Done |
| 10 | MCP Server | [010-mcp-server.md](010-mcp-server.md) | Done |
| 11 | Branch Support | [011-branches.md](011-branches.md) | Done |
| 12 | Content Hash Deduplication | [012-content-hash.md](012-content-hash.md) | Done |
| 13 | Event Webhooks | [013-webhooks.md](013-webhooks.md) | Done |
| 14 | Pending Contracts | [014-pending-contracts.md](014-pending-contracts.md) | Done |
| 15 | Consumer Version Selectors | [015-consumer-version-selectors.md](015-consumer-version-selectors.md) | Done |
| 16 | Compatibility Matrix | [016-compatibility-matrix.md](016-compatibility-matrix.md) | Done |
| 17 | Version Tags | [017-version-tags.md](017-version-tags.md) | Done |
| 18 | Data Cleanup | [018-data-cleanup.md](018-data-cleanup.md) | Done |
| 22 | Configurable Environments | [022-configurable-environments.md](022-configurable-environments.md) | Done |
| 23 | CLI | [023-cli.md](023-cli.md) | Done |
| 24 | JS/TS SDK | [024-js-sdk.md](024-js-sdk.md) | Done |
| 25 | Local JAR Support | [025-local-jar-support.md](025-local-jar-support.md) | Done |
| 26 | Stubs Packager | [026-stubs-packager.md](026-stubs-packager.md) | Done |
| 27 | Maven Import | [027-maven-import.md](027-maven-import.md) | Done |
| 29 | Git Repository Import | [029-git-import.md](029-git-import.md) | Done |
| 30 | Webhook Timeout | [030-webhook-timeout.md](030-webhook-timeout.md) | Done |
| 32 | Maven Stubs Discovery | [032-maven-stubs-discovery.md](032-maven-stubs-discovery.md) | Done |
| 34 | Maven Import UI | [034-maven-import-ui.md](034-maven-import-ui.md) | Done |
| 35 | Git Import UI | [035-git-import-ui.md](035-git-import-ui.md) | Done |
| 36 | Credential Encryption | [036-credential-encryption.md](036-credential-encryption.md) | Done |
| 37 | Audit Logging | [037-audit-logging.md](037-audit-logging.md) | Planned |
| 38 | Security Hardening | [038-security-hardening.md](038-security-hardening.md) | Done |
| 39 | Data Integrity | [039-data-integrity.md](039-data-integrity.md) | Done |
| 40 | MCP AI Features | [040-mcp-ai-features.md](040-mcp-ai-features.md) | Planned |

## Cross-Cutting Concerns

| # | Topic | Spec | Status |
|---|-------|------|--------|
| 19 | API Conventions | [019-api-conventions.md](019-api-conventions.md) | Done |
| 20 | Web UI | [020-ui.md](020-ui.md) | Done |
| 21 | Observability | [021-observability.md](021-observability.md) | Done |
| 28 | High Availability | [028-high-availability.md](028-high-availability.md) | Done |
| 31 | Migration Integrity | [031-migration-integrity.md](031-migration-integrity.md) | Done |
| 33 | Chaos Testing | [033-chaos-testing.md](033-chaos-testing.md) | Done |

## Spec Template

Each business feature spec follows: **What** / **Why** / **How** (high level) / **API** / **Business Rules** / **Acceptance Criteria** / **Error Cases**.

Cross-cutting specs describe conventions and behaviors that apply across all features.

Machine-parseable Given/When/Then acceptance criteria included in business feature specs.
