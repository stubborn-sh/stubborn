# ADR 0003: Spring Java Format for Code Style

## Status

Accepted

## Context

Consistent code formatting eliminates style debates and reduces diff noise in PRs.
We need an opinionated formatter that integrates with the Maven build.

## Decision

Use **Spring Java Format** (version 0.0.47) as the single source of truth for code style,
enforced via 5 static analysis tools:

1. Spring Java Format — auto-apply + validate
2. Checkstyle — spring-javaformat-checkstyle rules
3. Error Prone — compile-time bug detection
4. SpotBugs + FindSecBugs — bytecode analysis + security checks
5. PMD — custom rules for complexity limits

All tools fail the build on violation from day zero.

## Consequences

- **Positive**: Zero formatting debates — the tool decides
- **Positive**: Consistent style across all contributors
- **Positive**: Security issues caught at build time (FindSecBugs)
- **Negative**: Spring Java Format uses tab indentation (opinionated)
- **Negative**: Error Prone requires JVM `--add-exports` flags for Java 21+
