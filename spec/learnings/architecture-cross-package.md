# Cross-Package Access Patterns

**Category:** Architecture
**Last Updated:** 2026-02-27

## Related Files
- `broker/src/main/java/.../environment/DeploymentInfo.java`
- `broker/src/main/java/.../application/ApplicationService.java`
- `broker/src/main/java/.../verification/VerificationService.java`

## Findings

### 2026-02-27: Pattern for cross-feature communication

With package-private entities, cross-package access requires explicit public APIs:

1. **Public service methods returning primitives/UUIDs:** `ApplicationService.findIdByName(String): UUID`
2. **Public DTO records:** `DeploymentInfo(UUID applicationId, String version)` for complex data
3. **Public service methods with boolean returns:** `VerificationService.hasSuccessfulVerification(...): boolean`

Entities remain package-private. Only services and DTOs are public when needed cross-package.

### 2026-02-27: E2E test isolation with shared database

Testcontainers uses a single PostgreSQL instance shared across all E2E tests. Environment
names and application names must be unique per test class to prevent cross-contamination.

**Example problem:** `CanIDeployE2ETest` saw deployments from `DeploymentE2ETest` when both
used "staging" as environment name, causing false consumer matches in the safety check.

**Fix:** Use unique prefixes: `cid-safe-env`, `cid-unsafe-env`, `e2e-deploy-*` etc.

## Change Log

| Date | Change |
|------|--------|
| 2026-02-27 | Initial discovery during Feature 5 implementation |
| 2026-02-27 | Updated file paths for multi-module restructure (broker/ prefix) |
