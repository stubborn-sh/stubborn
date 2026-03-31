# Contributing to Stubborn

Thank you for your interest in contributing.

## Workflow

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run the full build: `./mvnw clean install`
5. Push and open a pull request against `main`

## Building

```bash
# Full build (tests + static analysis)
./mvnw clean install

# Skip tests for a quick compile check
./mvnw clean install -DskipTests

# JS packages
cd js && npm install && npm run build && npm test
```

## Code Style

The project uses [Spring Java Format](https://github.com/spring-io/spring-javaformat). It is applied automatically during the build (`initialize` phase). Your IDE can apply it on save with the Spring Java Format plugin.

```bash
# Apply formatting manually
./mvnw spring-javaformat:apply
```

## Specs and Tests

Every behavior change requires:
- A spec in `spec/features/<feature>/` describing what changes and why
- Tests that verify the new behavior (write the test before the implementation)

See existing specs under `spec/features/` for examples.

## Pull Requests

- Keep PRs focused — one logical change per PR
- Include a clear description of what changed and why
- Ensure `./mvnw clean install` passes before opening the PR
- Reference any related issues

## Questions

Open an issue or start a discussion on GitHub.
