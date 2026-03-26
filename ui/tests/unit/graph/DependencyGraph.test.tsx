import { describe, it, expect } from "vitest";
import type { DependencyNode, DependencyEdge } from "@/api/types";

/**
 * Adversarial tests for the buildLayout function extracted from DependencyGraph.
 * We can't easily test React Flow rendering in jsdom, but we CAN test the layout
 * logic for edge cases, data inconsistencies, and crash scenarios.
 */

// Re-implement buildLayout logic for direct testing (same algorithm as DependencyGraph.tsx)
function buildLayout(
  graphNodes: DependencyNode[],
  graphEdges: DependencyEdge[],
  selectedNode: string | null,
) {
  // Deduplicate edges: one per unique provider-consumer pair
  const edgeMap = new Map<string, DependencyEdge>();
  graphEdges.forEach((e) => {
    const key = `${e.providerName}->${e.consumerName}`;
    const existing = edgeMap.get(key);
    if (!existing || new Date(e.verifiedAt) > new Date(existing.verifiedAt)) {
      edgeMap.set(key, e);
    }
  });
  const uniqueEdges = Array.from(edgeMap.values());

  // Connected nodes
  const connectedNodes = new Set<string>();
  if (selectedNode) {
    connectedNodes.add(selectedNode);
    uniqueEdges.forEach((e) => {
      if (e.providerName === selectedNode) connectedNodes.add(e.consumerName);
      if (e.consumerName === selectedNode) connectedNodes.add(e.providerName);
    });
  }

  // Node health
  const nodeHealth = new Map<string, boolean>();
  graphNodes.forEach((n) => nodeHealth.set(n.applicationName, true));
  uniqueEdges.forEach((e) => {
    if (e.status === "FAILED") {
      nodeHealth.set(e.providerName, false);
      nodeHealth.set(e.consumerName, false);
    }
  });

  return { uniqueEdges, connectedNodes, nodeHealth };
}

const makeEdge = (
  provider: string,
  consumer: string,
  status: "SUCCESS" | "FAILED" = "SUCCESS",
  verifiedAt = "2026-01-01T00:00:00Z",
): DependencyEdge => ({
  providerName: provider,
  providerVersion: "1.0.0",
  consumerName: consumer,
  consumerVersion: "1.0.0",
  status,
  verifiedAt,
});

const makeNode = (name: string): DependencyNode => ({
  applicationId: name,
  applicationName: name,
  owner: "team",
});

describe("DependencyGraph layout logic", () => {
  describe("edge deduplication", () => {
    it("should keep latest edge when multiple edges exist for same pair", () => {
      const edges = [
        makeEdge("A", "B", "FAILED", "2026-01-01T00:00:00Z"),
        makeEdge("A", "B", "SUCCESS", "2026-02-01T00:00:00Z"),
      ];
      const { uniqueEdges } = buildLayout([makeNode("A"), makeNode("B")], edges, null);
      expect(uniqueEdges).toHaveLength(1);
      expect(uniqueEdges[0].status).toBe("SUCCESS");
    });

    it("should keep older FAILED edge if it's newer than SUCCESS edge", () => {
      const edges = [
        makeEdge("A", "B", "SUCCESS", "2026-01-01T00:00:00Z"),
        makeEdge("A", "B", "FAILED", "2026-02-01T00:00:00Z"),
      ];
      const { uniqueEdges } = buildLayout([makeNode("A"), makeNode("B")], edges, null);
      expect(uniqueEdges).toHaveLength(1);
      expect(uniqueEdges[0].status).toBe("FAILED");
    });

    it("should treat A->B and B->A as separate edges", () => {
      const edges = [makeEdge("A", "B"), makeEdge("B", "A")];
      const { uniqueEdges } = buildLayout([makeNode("A"), makeNode("B")], edges, null);
      expect(uniqueEdges).toHaveLength(2);
    });

    it("should handle empty edges", () => {
      const { uniqueEdges } = buildLayout([makeNode("A")], [], null);
      expect(uniqueEdges).toHaveLength(0);
    });

    it("should handle empty nodes and edges", () => {
      const { uniqueEdges, nodeHealth } = buildLayout([], [], null);
      expect(uniqueEdges).toHaveLength(0);
      expect(nodeHealth.size).toBe(0);
    });
  });

  describe("node health", () => {
    it("should mark nodes healthy when all edges succeed", () => {
      const nodes = [makeNode("A"), makeNode("B")];
      const edges = [makeEdge("A", "B", "SUCCESS")];
      const { nodeHealth } = buildLayout(nodes, edges, null);
      expect(nodeHealth.get("A")).toBe(true);
      expect(nodeHealth.get("B")).toBe(true);
    });

    it("should mark BOTH nodes unhealthy when edge fails", () => {
      const nodes = [makeNode("A"), makeNode("B")];
      const edges = [makeEdge("A", "B", "FAILED")];
      const { nodeHealth } = buildLayout(nodes, edges, null);
      expect(nodeHealth.get("A")).toBe(false);
      expect(nodeHealth.get("B")).toBe(false);
    });

    it("should mark node unhealthy if ANY edge fails", () => {
      const nodes = [makeNode("A"), makeNode("B"), makeNode("C")];
      const edges = [makeEdge("A", "B", "SUCCESS"), makeEdge("A", "C", "FAILED")];
      const { nodeHealth } = buildLayout(nodes, edges, null);
      expect(nodeHealth.get("A")).toBe(false); // has a failed edge
      expect(nodeHealth.get("B")).toBe(true); // only success edge
      expect(nodeHealth.get("C")).toBe(false); // failed edge target
    });

    it("should default orphan nodes (no edges) to healthy", () => {
      const nodes = [makeNode("A"), makeNode("B"), makeNode("C")];
      const edges = [makeEdge("A", "B", "FAILED")];
      const { nodeHealth } = buildLayout(nodes, edges, null);
      expect(nodeHealth.get("C")).toBe(true);
    });
  });

  describe("selection / connected nodes", () => {
    it("should include selected node and direct neighbors", () => {
      const nodes = [makeNode("A"), makeNode("B"), makeNode("C")];
      const edges = [makeEdge("A", "B"), makeEdge("B", "C")];
      const { connectedNodes } = buildLayout(nodes, edges, "B");
      expect(connectedNodes.has("A")).toBe(true); // provider of B
      expect(connectedNodes.has("B")).toBe(true); // selected
      expect(connectedNodes.has("C")).toBe(true); // consumer of B
    });

    it("should NOT include 2-hop neighbors", () => {
      const nodes = [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")];
      const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "D")];
      const { connectedNodes } = buildLayout(nodes, edges, "B");
      expect(connectedNodes.has("D")).toBe(false); // 2 hops away
    });

    it("should return empty connected set when no selection", () => {
      const nodes = [makeNode("A"), makeNode("B")];
      const edges = [makeEdge("A", "B")];
      const { connectedNodes } = buildLayout(nodes, edges, null);
      expect(connectedNodes.size).toBe(0);
    });

    it("should handle selecting a node with no edges", () => {
      const nodes = [makeNode("A"), makeNode("B")];
      const { connectedNodes } = buildLayout(nodes, [], "A");
      expect(connectedNodes.size).toBe(1);
      expect(connectedNodes.has("A")).toBe(true);
    });
  });

  describe("edge cases with data inconsistency", () => {
    it("should handle edges referencing nodes not in nodes list", () => {
      // API returns an edge where consumer isn't in nodes list
      const nodes = [makeNode("A")];
      const edges = [makeEdge("A", "GHOST")];
      const { uniqueEdges, nodeHealth } = buildLayout(nodes, edges, null);
      expect(uniqueEdges).toHaveLength(1);
      // nodeHealth for GHOST is set by the edge loop but GHOST wasn't in original nodes
      expect(nodeHealth.get("A")).toBe(true);
      expect(nodeHealth.has("GHOST")).toBe(false); // never set as healthy initially
    });

    it("should handle duplicate node names in nodes list", () => {
      const nodes = [makeNode("A"), makeNode("A")];
      const edges = [makeEdge("A", "B")];
      const { nodeHealth } = buildLayout(nodes, edges, null);
      // Last one wins in the map
      expect(nodeHealth.get("A")).toBe(true);
    });

    it("should handle edges with identical timestamps", () => {
      const edges = [
        makeEdge("A", "B", "SUCCESS", "2026-01-01T00:00:00Z"),
        makeEdge("A", "B", "FAILED", "2026-01-01T00:00:00Z"),
      ];
      const { uniqueEdges } = buildLayout([makeNode("A"), makeNode("B")], edges, null);
      expect(uniqueEdges).toHaveLength(1);
      // Neither is strictly greater, so first one wins (SUCCESS)
      expect(uniqueEdges[0].status).toBe("SUCCESS");
    });
  });
});
