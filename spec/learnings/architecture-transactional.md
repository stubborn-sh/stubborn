# Transactional Annotations in Services

**Category:** Architecture
**Last Updated:** 2026-02-28

## Related Files

- `broker/src/main/java/**/application/ApplicationService.java`
- `broker/src/main/java/**/contract/ContractService.java`
- `broker/src/main/java/**/verification/VerificationService.java`
- `broker/src/main/java/**/environment/DeploymentService.java`
- `broker/src/main/java/**/safety/CanIDeployService.java`

## Findings

### Discovery (2026-02-28)

Spring Data JPA repositories are transactional by default. Each repository method
(findById, findAll, save, delete, exists*) runs in its own transaction.

**Rule:** Only add `@Transactional` to service methods that truly need it:

| Needs `@Transactional` | Reason |
|------------------------|--------|
| Check-then-write (existsBy + save) | Race condition prevention |
| Find-then-delete (findByName + delete) | Atomicity across two operations |
| Read-modify-write (find + update + save) | Consistent state mutation |

| Does NOT need `@Transactional` | Reason |
|-------------------------------|--------|
| Single repository read delegation | Repo method is already transactional |
| Multi-repo reads (resolve ID + query) | Each read is independently consistent |
| Pure computation on fetched data | No DB interaction to protect |

**Removed `@Transactional(readOnly = true)` from:**
- All single-repo read delegations (findByName, findAll, findById, findNameById)
- Multi-repo read chains (findByProviderAndVersion, findByApplicationAndVersion)
- Complex read-only orchestrations (CanIDeployService.check)

**Kept `@Transactional` on:**
- `ApplicationService.register()` — existsByName + save (race prevention)
- `ApplicationService.deleteByName()` — findByName + delete
- `ContractService.publish()` — findIdByName + existsBy + save
- `ContractService.delete()` — find + delete
- `VerificationService.record()` — existsBy + save
- `DeploymentService.recordDeployment()` — findOrCreate + save

## Change Log

| Date | Change |
|------|--------|
| 2026-02-28 | Initial discovery and cleanup |
