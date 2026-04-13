import { describe, it, expect } from "vitest";
import type { DependencyEdge, MessagingEdge } from "@/api/types";
import { inferSubscribers } from "@/features/graph/inferSubscribers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeEdge = (
  provider: string,
  consumer: string,
  status: "SUCCESS" | "FAILED" = "SUCCESS",
): DependencyEdge => ({
  providerName: provider,
  providerVersion: "1.0.0",
  consumerName: consumer,
  consumerVersion: "1.0.0",
  status,
  verifiedAt: "2026-01-01T00:00:00Z",
});

const makeMsgEdge = (app: string, topic: string): MessagingEdge => ({
  applicationName: app,
  topicName: topic,
  version: "1.0.0",
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("inferSubscribers", () => {
  it("should return original messaging edges when no verifications exist", () => {
    const msgEdges = [makeMsgEdge("order-service", "order-events")];
    const result = inferSubscribers([], msgEdges);
    expect(result).toEqual(msgEdges);
  });

  it("should return original messaging edges when no messaging edges exist", () => {
    const edges = [makeEdge("order-service", "payment-service")];
    const result = inferSubscribers(edges, []);
    expect(result).toEqual([]);
  });

  it("should infer subscriber when consumer verifies against a provider that publishes to a topic", () => {
    // order-service publishes to order-events
    // payment-service verifies against order-service
    // => payment-service subscribes to order-events
    const httpEdges = [makeEdge("order-service", "payment-service")];
    const msgEdges = [makeMsgEdge("order-service", "order-events")];

    const result = inferSubscribers(httpEdges, msgEdges);

    const subscriberEdge = result.find(
      (e) => e.applicationName === "payment-service" && e.topicName === "order-events",
    );
    expect(subscriberEdge).toBeDefined();
  });

  it("should keep the original publish edge alongside the inferred subscribe edge", () => {
    const httpEdges = [makeEdge("order-service", "payment-service")];
    const msgEdges = [makeMsgEdge("order-service", "order-events")];

    const result = inferSubscribers(httpEdges, msgEdges);

    const publishEdge = result.find(
      (e) => e.applicationName === "order-service" && e.topicName === "order-events",
    );
    expect(publishEdge).toBeDefined();
  });

  it("should not duplicate if consumer already has a messaging edge for that topic", () => {
    const httpEdges = [makeEdge("order-service", "payment-service")];
    const msgEdges = [
      makeMsgEdge("order-service", "order-events"),
      makeMsgEdge("payment-service", "order-events"), // already exists
    ];

    const result = inferSubscribers(httpEdges, msgEdges);

    const paymentEdges = result.filter(
      (e) => e.applicationName === "payment-service" && e.topicName === "order-events",
    );
    expect(paymentEdges).toHaveLength(1);
  });

  it("should infer multiple subscribers for the same topic", () => {
    // order-service publishes to order-events
    // both payment-service and notification-service verify against order-service
    const httpEdges = [
      makeEdge("order-service", "payment-service"),
      makeEdge("order-service", "notification-service"),
    ];
    const msgEdges = [makeMsgEdge("order-service", "order-events")];

    const result = inferSubscribers(httpEdges, msgEdges);

    expect(
      result.find((e) => e.applicationName === "payment-service" && e.topicName === "order-events"),
    ).toBeDefined();
    expect(
      result.find(
        (e) => e.applicationName === "notification-service" && e.topicName === "order-events",
      ),
    ).toBeDefined();
  });

  it("should infer subscriber across multiple topics", () => {
    // order-service publishes to order-events AND order-updates
    // payment-service verifies against order-service
    // => payment-service subscribes to both
    const httpEdges = [makeEdge("order-service", "payment-service")];
    const msgEdges = [
      makeMsgEdge("order-service", "order-events"),
      makeMsgEdge("order-service", "order-updates"),
    ];

    const result = inferSubscribers(httpEdges, msgEdges);

    expect(
      result.find((e) => e.applicationName === "payment-service" && e.topicName === "order-events"),
    ).toBeDefined();
    expect(
      result.find(
        (e) => e.applicationName === "payment-service" && e.topicName === "order-updates",
      ),
    ).toBeDefined();
  });

  it("should not infer subscriber when verification is FAILED", () => {
    const httpEdges = [makeEdge("order-service", "payment-service", "FAILED")];
    const msgEdges = [makeMsgEdge("order-service", "order-events")];

    const result = inferSubscribers(httpEdges, msgEdges);

    const subscriberEdge = result.find(
      (e) => e.applicationName === "payment-service" && e.topicName === "order-events",
    );
    expect(subscriberEdge).toBeUndefined();
  });

  it("should not infer subscriber for a provider that has no messaging edges", () => {
    // payment-service verifies against order-service, but order-service has no messaging edges
    const httpEdges = [makeEdge("order-service", "payment-service")];
    const msgEdges = [makeMsgEdge("inventory-service", "stock-events")];

    const result = inferSubscribers(httpEdges, msgEdges);

    expect(result).toHaveLength(1); // only the original stock-events edge
    expect(result[0].applicationName).toBe("inventory-service");
  });

  it("should not create self-referencing subscriber edge", () => {
    // order-service publishes to order-events AND verifies against itself (edge case)
    const httpEdges = [makeEdge("order-service", "order-service")];
    const msgEdges = [makeMsgEdge("order-service", "order-events")];

    const result = inferSubscribers(httpEdges, msgEdges);

    const orderEdges = result.filter(
      (e) => e.applicationName === "order-service" && e.topicName === "order-events",
    );
    // Should only have the original publish edge, not a self-subscribe
    expect(orderEdges).toHaveLength(1);
  });
});
