import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, resetState } from "../../src/server.js";
import { publishContracts } from "../../src/publish.js";
import { verifyContracts } from "../../src/verify.js";

const BROKER_URL = process.env["BROKER_URL"] ?? "http://localhost:18080";
const BROKER_USERNAME = process.env["BROKER_USERNAME"] ?? "admin";
const BROKER_PASSWORD = process.env["BROKER_PASSWORD"] ?? "admin";

describe("JS Producer contract flow", () => {
  let serverPort: number;

  beforeAll(async () => {
    resetState();
    serverPort = await startServer(0);
    // Publish contracts once — both tests depend on them being in the broker
    await publishContracts(BROKER_URL, BROKER_USERNAME, BROKER_PASSWORD, "product-service", "1.0.0");
  });

  afterAll(async () => {
    await stopServer();
  });

  it("should publish contracts to the broker", async () => {
    // Re-publish is idempotent — verify it doesn't throw on second call
    await expect(
      publishContracts(BROKER_URL, BROKER_USERNAME, BROKER_PASSWORD, "product-service", "1.0.0"),
    ).resolves.not.toThrow();
  });

  it("should verify contracts against the running server", async () => {
    const passed = await verifyContracts(
      `http://localhost:${serverPort}`,
      BROKER_URL,
      BROKER_USERNAME,
      BROKER_PASSWORD,
    );
    expect(passed).toBe(true);
  });
});
