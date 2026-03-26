# ADR 0001: Vertical Slice Architecture

## Status

Accepted

## Context

The broker has 7 distinct features (application registration, contract publishing,
verification results, environment tracking, can-i-deploy, security, AI proxy). We need
a code organization strategy that supports independent feature development and clear
module boundaries.

## Decision

Organize code by **feature (vertical slices)**, not by technical layer.

Each feature has its own `api/`, `domain/`, and `infrastructure/` sub-packages:

```
broker/
├── application/       # Feature 1
│   ├── api/           # Controller, DTOs
│   ├── domain/        # Entity, value objects, service
│   └── infrastructure/# Repository
├── contract/          # Feature 2
├── verification/      # Feature 3
...
```

## Consequences

- **Positive**: Features are cohesive — all related code lives together
- **Positive**: Easy to understand feature scope by looking at one package
- **Positive**: Package-private visibility enforces encapsulation between features
- **Positive**: Features can be developed and tested independently
- **Negative**: Cross-cutting concerns (security, observability) need separate packages
- **Negative**: Shared domain objects require explicit facade/API between slices
