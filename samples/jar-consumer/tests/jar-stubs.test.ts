import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupStubs, teardownStubs } from "@stubborn-sh/jest";
import { OrderServiceClient } from "../src/client.js";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Loads stubs from a local maven-producer stubs JAR.
 *
 * Prerequisite: install the Java producer's stubs JAR locally:
 *   cd samples/maven-producer && ../../mvnw install -DskipTests
 *
 * Override JAR path with STUBS_JAR_PATH env var if needed.
 */

// The Maven producer installs its stubs JAR under its real coordinates
// (sh.stubborn:sample-maven-producer). The version can be overridden via
// STUBS_JAR_VERSION (the jar-consumer-test exec passes the reactor ${project.version});
// STUBS_JAR_PATH overrides the whole path.
const STUBS_JAR_VERSION = process.env["STUBS_JAR_VERSION"] ?? "0.4.0-SNAPSHOT";
const DEFAULT_JAR_PATH = join(
  homedir(),
  ".m2",
  "repository",
  "sh",
  "stubborn",
  "sample-maven-producer",
  STUBS_JAR_VERSION,
  `sample-maven-producer-${STUBS_JAR_VERSION}-stubs.jar`,
);

const STUBS_JAR_PATH = process.env["STUBS_JAR_PATH"] ?? DEFAULT_JAR_PATH;

describe("JAR consumer — local stubs", () => {
  let stubPort: number;

  beforeAll(async () => {
    stubPort = await setupStubs({
      jarPath: STUBS_JAR_PATH,
    });
  });

  afterAll(async () => {
    await teardownStubs();
  });

  it("should fetch an order from local stubs JAR", async () => {
    const client = new OrderServiceClient(`http://localhost:${stubPort}`);
    const order = await client.getOrder("1");

    expect(order.id).toBe("1");
    expect(order.product).toBe("MacBook Pro");
    expect(order.amount).toBe(1299.99);
    expect(order.status).toBe("CREATED");
  });

  it("should create an order via local stubs JAR", async () => {
    const client = new OrderServiceClient(`http://localhost:${stubPort}`);
    const order = await client.createOrder("iPhone 16", 999.99);

    expect(order.product).toBe("iPhone 16");
    expect(order.amount).toBe(999.99);
    expect(order.status).toBe("CREATED");
    expect(order.id).toMatch(/[0-9]+/);
  });
});
