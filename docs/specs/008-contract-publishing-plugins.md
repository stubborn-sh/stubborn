# Feature 8: Contract Publishing Plugins

## What

Build tool plugins (Maven and Gradle) that automate contract publishing to the broker as
part of the standard build lifecycle. A shared core library (`BrokerPublisher`) provides
the publishing logic, while the Maven and Gradle plugins expose it as build goals/tasks.

## Why

- Manually calling the broker REST API from CI scripts is fragile and error-prone
- Build tool integration lets teams publish contracts with a single command (`mvn broker:publish` or `gradle publishContracts`)
- Consistent configuration across projects (broker URL, credentials, app name, version)
- Fits naturally into existing Spring Cloud Contract workflows where contracts live alongside source code
- Reduces onboarding friction: add the plugin, configure, done

## Who

- **Producers** add the plugin to their build and publish contracts as part of CI/CD
- **Platform teams** standardize contract publishing across all services
- **Consumers** benefit indirectly: contracts appear in the broker automatically after producer builds

## How It Works

1. Producer adds the Maven or Gradle plugin to their build
2. Plugin is configured with broker URL, credentials, application name, and version
3. Plugin scans a contracts directory for contract files (YAML, Groovy, or Java DSL)
4. Core library (`BrokerPublisher`) ensures the application is registered, then publishes each contract via the broker REST API
5. Plugin reports success/failure per contract and fails the build on errors

### Core Library: BrokerPublisher

A standalone Java library with no Spring dependency. Accepts configuration and a list of
contract files, then calls the broker REST API:

1. `GET /api/v1/applications/{name}` -- check if application exists
2. `POST /api/v1/applications` -- register application if not found (auto-registration)
3. `POST /api/v1/applications/{name}/versions/{version}/contracts` -- publish each contract

Auto-registration is opt-in via `autoCreateApplication` flag (default: `true`).

### Maven Plugin

Plugin coordinates: `org.springframework.cloud:broker-maven-plugin`

Goal: `publish` (default phase: `install`)

```xml
<plugin>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>broker-maven-plugin</artifactId>
    <version>${broker.version}</version>
    <configuration>
        <brokerUrl>http://localhost:8080</brokerUrl>
        <username>publisher</username>
        <password>publisher</password>
        <applicationName>${project.artifactId}</applicationName>
        <applicationVersion>${project.version}</applicationVersion>
        <contractsDirectory>${project.basedir}/src/test/resources/contracts</contractsDirectory>
        <autoCreateApplication>true</autoCreateApplication>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>publish</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

### Gradle Plugin

Plugin ID: `com.toomuchcoding.broker`

Task: `publishContracts` (depends on `test`)

```groovy
plugins {
    id 'com.toomuchcoding.broker' version "${brokerVersion}"
}

broker {
    brokerUrl = 'http://localhost:8080'
    username = 'publisher'
    password = 'publisher'
    applicationName = project.name
    applicationVersion = project.version
    contractsDirectory = file("src/test/resources/contracts")
    autoCreateApplication = true
}
```

## Configuration Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `brokerUrl` | Yes | -- | Base URL of the broker (e.g., `http://localhost:8080`) |
| `username` | Yes | -- | HTTP Basic auth username |
| `password` | Yes | -- | HTTP Basic auth password |
| `applicationName` | Yes | `${project.artifactId}` / `project.name` | Name of the application in the broker |
| `applicationVersion` | Yes | `${project.version}` | Version to publish contracts under |
| `contractsDirectory` | No | `src/test/resources/contracts` | Directory containing contract files |
| `autoCreateApplication` | No | `true` | Register the application if it does not exist |
| `failOnError` | No | `true` | Fail the build if any contract fails to publish |
| `skipPublish` | No | `false` | Skip contract publishing entirely |

## Business Rules

1. The plugin scans `contractsDirectory` recursively for files with extensions `.yml`, `.yaml`, `.groovy`, and `.java`
2. Contract name is derived from the file name without extension (e.g., `create-order.yml` becomes `create-order`)
3. Content type is inferred from file extension: `.yml`/`.yaml` maps to `application/x-spring-cloud-contract+yaml`, `.groovy` maps to `application/x-spring-cloud-contract+groovy`, `.java` maps to `application/x-spring-cloud-contract+java`
4. If `contractsDirectory` does not exist or contains no contract files, the plugin logs a warning and succeeds (no-op)
5. If `autoCreateApplication` is `true` and the application does not exist, the plugin creates it with the application name as both name and owner
6. If the broker returns 409 Conflict (contract already exists), the plugin logs a warning and continues to the next contract (idempotent republish)
7. Credentials are never logged; only the broker URL and application name appear in build output
8. The plugin validates that `brokerUrl`, `username`, `password`, and `applicationName` are all non-empty before making any HTTP calls

## Error Cases

| Scenario | Behavior | Build Result |
|----------|----------|--------------|
| Missing required configuration (brokerUrl, credentials) | Fail immediately with descriptive message | FAILURE |
| Authentication failure (401/403) | Fail with "Authentication failed" message | FAILURE |
| Broker unreachable (connection refused/timeout) | Fail with "Cannot connect to broker" message | FAILURE |
| Server error (5xx) | Fail with HTTP status and response body | FAILURE |
| Contract already exists (409) | Log warning, continue to next contract | SUCCESS |
| Contracts directory missing | Log warning, skip publishing | SUCCESS |
| No contract files found | Log warning, skip publishing | SUCCESS |
| Invalid contract file (empty content) | Fail with file name in error message | FAILURE (if `failOnError=true`) |
| Application auto-registration fails | Fail with broker error details | FAILURE |

## Acceptance Criteria

### Maven Plugin -- Publish Contracts

**Given** a Maven project with `broker-maven-plugin` configured
**And** the contracts directory contains `create-order.yml` and `delete-order.groovy`
**And** the broker is running at the configured URL
**When** I run `mvn broker:publish`
**Then** both contracts are published to the broker under the configured application name and version
**And** the build output shows "Published 2 contracts for order-service version 1.0.0"

### Gradle Plugin -- Publish Contracts

**Given** a Gradle project with `com.toomuchcoding.broker` plugin applied
**And** the contracts directory contains `create-order.yml`
**And** the broker is running at the configured URL
**When** I run `gradle publishContracts`
**Then** the contract is published to the broker
**And** the task output shows "Published 1 contract for order-service version 1.0.0"

### Auto-Create Application

**Given** a plugin configured with `autoCreateApplication=true`
**And** no application named "order-service" exists in the broker
**When** the plugin runs
**Then** the application "order-service" is registered automatically
**And** contracts are published successfully

### Auto-Create Application Disabled

**Given** a plugin configured with `autoCreateApplication=false`
**And** no application named "order-service" exists in the broker
**When** the plugin runs
**Then** the build fails with "Application 'order-service' not found in broker"

### Authentication Failure

**Given** a plugin configured with invalid credentials
**When** the plugin runs
**Then** the build fails with "Authentication failed -- check broker credentials"

### Broker Unreachable

**Given** a plugin configured with a broker URL that is not reachable
**When** the plugin runs
**Then** the build fails with "Cannot connect to broker at http://localhost:9999"

### Idempotent Republish

**Given** contracts have already been published for "order-service" version "1.0.0"
**When** the plugin runs again for the same version
**Then** conflicting contracts are skipped with a warning
**And** the build succeeds

### Empty Contracts Directory

**Given** the configured contracts directory exists but contains no contract files
**When** the plugin runs
**Then** the build succeeds with a warning "No contract files found"

### Skip Publishing

**Given** a plugin configured with `skipPublish=true`
**When** the plugin runs
**Then** no HTTP calls are made to the broker
**And** the build succeeds

### Content Type Detection

**Given** contracts directory contains `order.yml`, `payment.groovy`, and `shipping.java`
**When** the plugin runs
**Then** `order.yml` is published with content type `application/x-spring-cloud-contract+yaml`
**And** `payment.groovy` is published with content type `application/x-spring-cloud-contract+groovy`
**And** `shipping.java` is published with content type `application/x-spring-cloud-contract+java`
