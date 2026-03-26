import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupStubs, teardownStubs } from "@stubborn-sh/jest";
import { BrokerClient } from "@stubborn-sh/broker-client";
import { OrderServiceClient } from "../../src/client.js";

const BROKER_URL = process.env["BROKER_URL"] ?? "http://localhost:18080";
const BROKER_USERNAME = process.env["BROKER_USERNAME"] ?? "admin";
const BROKER_PASSWORD = process.env["BROKER_PASSWORD"] ?? "admin";

describe("JS Consumer contract flow", () => {
  let stubPort: number;

  beforeAll(async () => {
    // Fetch order-service stubs from the broker and start a stub server
    stubPort = await setupStubs({
      brokerUrl: BROKER_URL,
      applicationName: "order-service",
      version: "1.0.0",
      username: BROKER_USERNAME,
      password: BROKER_PASSWORD,
    });
  });

  afterAll(async () => {
    await teardownStubs();
  });

  it("should fetch an order from the stub server", async () => {
    const client = new OrderServiceClient(`http://localhost:${stubPort}`);
    const order = await client.getOrder("1");

    expect(order.id).toBe("1");
    expect(order.product).toBe("MacBook Pro");
    expect(order.amount).toBe(1299.99);
    expect(order.status).toBe("CREATED");
  });

  it("should create an order via the stub server", async () => {
    const client = new OrderServiceClient(`http://localhost:${stubPort}`);
    const order = await client.createOrder("iPhone 16", 999.99);

    expect(order.product).toBe("iPhone 16");
    expect(order.amount).toBe(999.99);
    expect(order.status).toBe("CREATED");
    expect(order.id).toMatch(/[0-9]+/);
  });

  it("should report verification results to the broker", async () => {
    const client = new BrokerClient({
      baseUrl: BROKER_URL,
      username: BROKER_USERNAME,
      password: BROKER_PASSWORD,
    });

    const result = await client.recordVerification({
      providerName: "order-service",
      providerVersion: "1.0.0",
      consumerName: "js-consumer",
      consumerVersion: "1.0.0",
      status: "SUCCESS",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.providerName).toBe("order-service");
    expect(result.consumerName).toBe("js-consumer");
  });
});
