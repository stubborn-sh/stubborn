# Spring Cloud Contract Broker Samples

Sample pairs demonstrating different contract testing workflows through the broker,
including cross-language testing between Java and JavaScript/TypeScript.

## Prerequisites

- Docker (for broker + PostgreSQL containers)
- Java 25+ (for Maven samples)
- Gradle 8+ (for Gradle samples, uses wrapper)
- Node.js 22+ (for JS samples)
- `OPENAI_API_KEY` (only for Pair 3 — proxy samples)

## Quick Start

```bash
# Build the broker Docker image first (from project root)
./mvnw clean install -pl broker -DskipTests

# Start broker + PostgreSQL
cd samples
docker compose up -d --wait

# Run Maven samples (Pair 1)
cd ..
./mvnw failsafe:integration-test failsafe:verify -pl samples/maven-producer,samples/maven-consumer

# Stop infrastructure
cd samples
docker compose down
```

## Sample Pairs

### Pair 1: Producer-Driven (Maven)

**Flow:**
1. `maven-producer` defines YAML contracts in `src/test/resources/contracts/`
2. Spring Cloud Contract Maven plugin generates tests from contracts
3. Generated tests verify `OrderController` against contracts
4. `BrokerPublishIT` publishes contracts to the broker REST API
5. `maven-consumer` uses `@AutoConfigureStubRunner` with `sccbroker://` protocol
6. `BrokerStubDownloader` fetches contracts from broker, configures WireMock stubs
7. `BrokerUsageReportIT` reports verification results back to broker

| Module | App | Role |
|--------|-----|------|
| `maven-producer` | Order Service | Defines + publishes contracts |
| `maven-consumer` | Payment Service | Consumes stubs from broker |

### Pair 2: Consumer-Driven (Gradle)

**Flow:**
1. `gradle-consumer` defines contracts and pushes them to the broker
2. `gradle-producer` pulls contracts from broker and verifies its implementation
3. Verification results reported back to broker

| Module | App | Role |
|--------|-----|------|
| `gradle-consumer` | Inventory Service | Defines + pushes consumer contracts |
| `gradle-producer` | Order Service | Verifies against consumer contracts |

### Pair 3: Proxy-Based (Manual)

Requires `OPENAI_API_KEY`. The AI proxy captures HTTP traffic and generates contracts automatically.

**Flow:**
1. Start broker + proxy: `docker compose --profile proxy up -d --wait`
2. `proxy-producer` sends traffic through the AI proxy
3. Proxy captures traffic and generates SCC contracts via AI
4. `proxy-consumer` validates generated contracts exist in broker

```bash
# Start with proxy profile
cd samples
OPENAI_API_KEY=sk-... docker compose --profile proxy up -d --wait

# Run proxy samples
cd ..
./mvnw failsafe:integration-test failsafe:verify \
  -pl samples/proxy-producer,samples/proxy-consumer \
  -Dbroker.url=http://localhost:18080 \
  -Dproxy.url=http://localhost:18081
```

| Module | App | Role |
|--------|-----|------|
| `proxy-producer` | Shipping Service | Generates traffic via proxy |
| `proxy-consumer` | Order Service | Validates AI-generated contracts |

### Pair 4: JS Producer → Java Consumer (Cross-Language)

**Flow:**
1. `js-producer` defines YAML contracts for a Product API
2. Contracts are published to broker via `@spring-cloud-contract/publisher`
3. The JS server is started and contracts are verified via `@spring-cloud-contract/verifier`
4. Verification results are reported to the broker
5. `maven-consumer` can consume the JS-published stubs via `@AutoConfigureStubRunner`

```bash
cd samples/js-producer
npm install && npm run test:integration
```

| Module | App | Role |
|--------|-----|------|
| `js-producer` | Product Service (Node.js) | Defines YAML contracts, publishes + verifies |
| `maven-consumer` | Payment Service (Java) | Can consume JS-published stubs via StubRunner |

### Pair 5: Java Producer → JS Consumer (Cross-Language)

**Flow:**
1. `maven-producer` publishes Order Service contracts to broker (same as Pair 1)
2. `js-consumer` fetches stubs from broker via `@spring-cloud-contract/jest` `setupStubs()`
3. A Node.js stub server starts, serving contract responses
4. JS client tests validate against the stub server
5. Verification results reported to broker via `@spring-cloud-contract/broker-client`

```bash
cd samples/js-consumer
npm install && npm run test:integration
```

| Module | App | Role |
|--------|-----|------|
| `maven-producer` | Order Service (Java) | Publishes contracts to broker |
| `js-consumer` | JS Client (Node.js) | Consumes Java stubs via stub-server |

### Pair 6: Local JAR Consumer (No Broker)

**Flow:**
1. `maven-producer` installs stubs JAR to `~/.m2/repository/` via `mvn install`
2. `jar-consumer` loads the local stubs JAR via `setupStubs({ jarPath: "..." })`
3. A Node.js stub server starts, serving contract responses from the JAR
4. JS client tests validate against the stub server — no broker needed

```bash
# Install the producer's stubs JAR
cd samples/maven-producer && ../../mvnw install -DskipTests

# Run the JS consumer against the local JAR
cd samples/jar-consumer && npm ci && npm test
```

| Module | App | Role |
|--------|-----|------|
| `maven-producer` | Order Service (Java) | Installs stubs JAR to local Maven repo |
| `jar-consumer` | JS Client (Node.js) | Loads stubs from local JAR, no broker |

## Contract Examples

### YAML Contract (Pair 1)

```yaml
# samples/maven-producer/src/test/resources/contracts/order/shouldReturnOrder.yaml
request:
  method: GET
  urlPath: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: "1"
    product: "MacBook Pro"
    amount: 1299.99
    status: "CREATED"
```

### Consumer StubRunner Configuration (Pair 1)

```java
@AutoConfigureStubRunner(
    ids = "org.example:order-service:1.0.0:stubs",
    repositoryRoot = "sccbroker://http://localhost:18080",
    stubsMode = StubRunnerProperties.StubsMode.REMOTE,
    properties = {
        "stubrunner.username=reader",
        "stubrunner.password=reader"
    }
)
class OrderServiceContractIT { }
```

## Docker Compose Services

| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 15432 | PostgreSQL for broker |
| `broker` | 18080 | Spring Cloud Contract Broker |
| `proxy` | 18081 | AI traffic-to-contract proxy (profile: `proxy`) |

## Automated Build

Pairs 1, 2, 4, and 5 run automatically in the Maven reactor build:
```bash
./mvnw clean verify -T 1C
```

The `samples/pom.xml` manages the Docker Compose lifecycle:
- `pre-integration-test`: `docker compose up -d --wait`
- `integration-test`: Failsafe runs `*IT.java` tests + `exec-maven-plugin` runs JS samples via `npm`
- `post-integration-test`: `docker compose down`

Pair 3 (proxy) is excluded from automated builds and requires manual execution with `OPENAI_API_KEY`.
