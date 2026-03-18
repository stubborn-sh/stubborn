# ADR 0002: Test-First Development Workflow

## Status

Accepted

## Context

We need a development methodology that ensures high code quality, catches regressions
early, and produces well-documented behavior through executable specifications.

## Decision

Follow **SPEC -> TEST -> IMPLEMENT -> VERIFY** for every feature:

1. Write the feature spec (markdown: what/why/how, business rules, acceptance criteria)
2. Write ALL failing tests first (6 layers: unit, property, slice, contract, E2E, mutation)
3. Implement only enough code to make tests pass
4. Verify with full build (static analysis + all test layers + mutation coverage >= 80%)

## Consequences

- **Positive**: Tests document expected behavior before implementation
- **Positive**: No untested code paths — implementation is driven by tests
- **Positive**: Mutation testing catches tests that don't actually verify behavior
- **Positive**: Spec-first ensures we build the right thing
- **Negative**: Higher upfront effort per feature
- **Negative**: Test compilation errors until implementation exists (expected)
