# JAR Consumer Sample

Demonstrates a TypeScript consumer using stubs from a **local Maven stubs JAR** — no broker needed.

## Prerequisites

Install the Java producer's stubs JAR locally:

```bash
cd samples/maven-producer && ../../mvnw install -DskipTests
```

## Run

```bash
cd samples/jar-consumer
npm ci
npm test
```

## Custom JAR Path

Override the default `~/.m2/repository/...` path:

```bash
STUBS_JAR_PATH=/path/to/stubs.jar npm test
```
