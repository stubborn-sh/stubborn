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
  describe("publishers", () => {
    it("should return original messaging edges as publishers", () => {
      const msgEdges = [makeMsgEdge("order-service", "order-events")];
      const result = inferSubscribers([], msgEdges);
      expect(result.publishers).toEqual(msgEdges);
      expect(result.subscribers).toEqual([]);
    });

    it("should return empty publishers when no messaging edges exist", () => {
      const result = inferSubscribers([makeEdge("A", "B")], []);
      expect(result.publishers).toEqual([]);
    });
  });

  describe("subscriber inference", () => {
    it("should infer subscriber when consumer verifies against a publishing provider", () => {
      const httpEdges = [makeEdge("order-service", "payment-service")];
      const msgEdges = [makeMsgEdge("order-service", "order-events")];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.subscribers).toHaveLength(1);
      expect(result.subscribers[0].applicationName).toBe("payment-service");
      expect(result.subscribers[0].topicName).toBe("order-events");
    });

    it("should keep publishers unchanged alongside inferred subscribers", () => {
      const httpEdges = [makeEdge("order-service", "payment-service")];
      const msgEdges = [makeMsgEdge("order-service", "order-events")];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.publishers).toHaveLength(1);
      expect(result.publishers[0].applicationName).toBe("order-service");
    });

    it("should not duplicate if consumer already publishes to that topic", () => {
      const httpEdges = [makeEdge("order-service", "payment-service")];
      const msgEdges = [
        makeMsgEdge("order-service", "order-events"),
        makeMsgEdge("payment-service", "order-events"),
      ];

      const result = inferSubscribers(httpEdges, msgEdges);

      const paymentSubs = result.subscribers.filter(
        (e) => e.applicationName === "payment-service" && e.topicName === "order-events",
      );
      expect(paymentSubs).toHaveLength(0); // already a publisher, not added as subscriber
    });

    it("should infer multiple subscribers for the same topic", () => {
      const httpEdges = [
        makeEdge("order-service", "payment-service"),
        makeEdge("order-service", "notification-service"),
      ];
      const msgEdges = [makeMsgEdge("order-service", "order-events")];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.subscribers).toHaveLength(2);
      expect(result.subscribers.map((s) => s.applicationName).sort()).toEqual([
        "notification-service",
        "payment-service",
      ]);
    });

    it("should infer subscriber across multiple topics", () => {
      const httpEdges = [makeEdge("order-service", "payment-service")];
      const msgEdges = [
        makeMsgEdge("order-service", "order-events"),
        makeMsgEdge("order-service", "order-updates"),
      ];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.subscribers).toHaveLength(2);
      expect(result.subscribers.map((s) => s.topicName).sort()).toEqual([
        "order-events",
        "order-updates",
      ]);
    });

    it("should not infer subscriber when verification is FAILED", () => {
      const httpEdges = [makeEdge("order-service", "payment-service", "FAILED")];
      const msgEdges = [makeMsgEdge("order-service", "order-events")];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.subscribers).toHaveLength(0);
    });

    it("should not infer subscriber for a provider with no messaging edges", () => {
      const httpEdges = [makeEdge("order-service", "payment-service")];
      const msgEdges = [makeMsgEdge("inventory-service", "stock-events")];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.subscribers).toHaveLength(0);
      expect(result.publishers).toHaveLength(1);
    });

    it("should not create self-referencing subscriber", () => {
      const httpEdges = [makeEdge("order-service", "order-service")];
      const msgEdges = [makeMsgEdge("order-service", "order-events")];

      const result = inferSubscribers(httpEdges, msgEdges);

      expect(result.subscribers).toHaveLength(0);
    });

    it("should return empty subscribers when no verifications exist", () => {
      const result = inferSubscribers([], [makeMsgEdge("A", "topic-a")]);
      expect(result.subscribers).toHaveLength(0);
    });
  });
});
