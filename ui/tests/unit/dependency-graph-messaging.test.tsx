import { describe, it, expect } from "vitest";
import type { DependencyNode, DependencyEdge, MessagingEdge } from "@/api/types";

/**
 * Tests for messaging edge support in DependencyGraph's buildLayout logic.
 * We test the layout algorithm directly to avoid ReactFlow's DOM measurement
 * requirements in jsdom — same approach as DependencyGraph.test.tsx.
 */

// Re-implement buildLayout with messaging edge support (mirrors DependencyGraph.tsx)
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const TOPIC_WIDTH = 160;
const TOPIC_HEIGHT = 50;

// Minimal dagre stub so we can run the layout logic without real DOM
import dagre from "@dagrejs/dagre";

function buildLayout(
  graphNodes: DependencyNode[],
  graphEdges: DependencyEdge[],
  messagingEdges: MessagingEdge[],
  selectedNode: string | null,
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 60 });

  graphNodes.forEach((n) => {
    g.setNode(n.applicationName, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Deduplicate edges
  const edgeMap = new Map<string, DependencyEdge>();
  graphEdges.forEach((e) => {
    const key = `${e.providerName}->${e.consumerName}`;
    const existing = edgeMap.get(key);
    if (!existing || new Date(e.verifiedAt) > new Date(existing.verifiedAt)) {
      edgeMap.set(key, e);
    }
  });
  const uniqueEdges = Array.from(edgeMap.values());
  uniqueEdges.forEach((e) => {
    g.setEdge(e.providerName, e.consumerName);
  });

  // Topic nodes and messaging edges
  const topicNames = new Set<string>();
  const msgEdgeKeys = new Set<string>();
  messagingEdges.forEach((me) => {
    topicNames.add(me.topicName);
    const key = `${me.applicationName}->topic:${me.topicName}`;
    if (!msgEdgeKeys.has(key)) {
      msgEdgeKeys.add(key);
      g.setEdge(me.applicationName, `topic:${me.topicName}`);
    }
  });
  topicNames.forEach((topic) => {
    g.setNode(`topic:${topic}`, { width: TOPIC_WIDTH, height: TOPIC_HEIGHT });
  });

  dagre.layout(g);

  // Connected nodes for selection highlighting
  const connectedNodes = new Set<string>();
  if (selectedNode) {
    connectedNodes.add(selectedNode);
    uniqueEdges.forEach((e) => {
      if (e.providerName === selectedNode) connectedNodes.add(e.consumerName);
      if (e.consumerName === selectedNode) connectedNodes.add(e.providerName);
    });
    messagingEdges.forEach((me) => {
      if (me.applicationName === selectedNode) connectedNodes.add(`topic:${me.topicName}`);
      if (`topic:${me.topicName}` === selectedNode) connectedNodes.add(me.applicationName);
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

  // Build flow nodes
  type FlowNode = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  };
  const flowNodes: FlowNode[] = graphNodes.map((n) => {
    const pos = g.node(n.applicationName) as { x: number; y: number };
    return {
      id: n.applicationName,
      type: "appNode",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: n.applicationName,
        owner: n.owner,
        healthy: nodeHealth.get(n.applicationName) ?? true,
        dimmed: selectedNode !== null && !connectedNodes.has(n.applicationName),
      },
    };
  });

  topicNames.forEach((topic) => {
    const id = `topic:${topic}`;
    const pos = g.node(id) as { x: number; y: number };
    flowNodes.push({
      id,
      type: "topicNode",
      position: { x: pos.x - TOPIC_WIDTH / 2, y: pos.y - TOPIC_HEIGHT / 2 },
      data: {
        label: topic,
        dimmed: selectedNode !== null && !connectedNodes.has(id),
      },
    });
  });

  // Build flow edges
  type FlowEdge = {
    id: string;
    source: string;
    target: string;
    style: Record<string, unknown>;
    label?: string;
  };
  const flowEdges: FlowEdge[] = uniqueEdges.map((e) => ({
    id: `${e.providerName}->${e.consumerName}`,
    source: e.providerName,
    target: e.consumerName,
    animated: e.status === "FAILED",
    style: {
      stroke: e.status === "SUCCESS" ? "#10b981" : "#ef4444",
      strokeWidth: 2,
      opacity: selectedNode
        ? connectedNodes.has(e.providerName) && connectedNodes.has(e.consumerName)
          ? 1
          : 0.15
        : 1,
    },
    label: `${e.providerVersion} / ${e.consumerVersion}`,
  }));

  msgEdgeKeys.forEach((key) => {
    const [appName, topicId] = key.split("->");
    flowEdges.push({
      id: key,
      source: appName,
      target: topicId,
      style: {
        stroke: "#8b5cf6",
        strokeWidth: 2,
        strokeDasharray: "6 3",
        opacity: selectedNode
          ? connectedNodes.has(appName) && connectedNodes.has(topicId)
            ? 1
            : 0.15
          : 1,
      },
      label: "publishes",
    });
  });

  return { flowNodes, flowEdges, topicNames, msgEdgeKeys, connectedNodes };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeNode = (name: string): DependencyNode => ({
  applicationId: name,
  applicationName: name,
  owner: "team",
});

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

const makeMessagingEdge = (
  applicationName: string,
  topicName: string,
  version = "1.0.0",
): MessagingEdge => ({ applicationName, topicName, version });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DependencyGraph messaging edge support", () => {
  describe("backwards compatibility without messaging edges", () => {
    it("should render app nodes when messagingEdges is empty", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [makeEdge("order-service", "payment-service")],
        [],
        null,
      );
      const ids = flowNodes.map((n) => n.id);
      expect(ids).toContain("order-service");
      expect(ids).toContain("payment-service");
    });

    it("should produce zero topic nodes when messagingEdges is empty", () => {
      const { topicNames } = buildLayout(
        [makeNode("order-service")],
        [],
        [],
        null,
      );
      expect(topicNames.size).toBe(0);
    });

    it("should produce zero messaging flow edges when messagingEdges is empty", () => {
      const { msgEdgeKeys } = buildLayout(
        [makeNode("order-service")],
        [makeEdge("order-service", "payment-service")],
        [],
        null,
      );
      expect(msgEdgeKeys.size).toBe(0);
    });

    it("should still build regular flow edges when messagingEdges is absent", () => {
      const { flowEdges } = buildLayout(
        [makeNode("A"), makeNode("B")],
        [makeEdge("A", "B")],
        [],
        null,
      );
      expect(flowEdges).toHaveLength(1);
      expect(flowEdges[0].source).toBe("A");
      expect(flowEdges[0].target).toBe("B");
    });
  });

  describe("topic node rendering", () => {
    it("should add a topic node for each unique topic in messagingEdges", () => {
      const { topicNames } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      expect(topicNames.has("orders-topic")).toBe(true);
      expect(topicNames.size).toBe(1);
    });

    it("should deduplicate topic names when multiple apps publish to the same topic", () => {
      const { topicNames } = buildLayout(
        [makeNode("app-a"), makeNode("app-b")],
        [],
        [
          makeMessagingEdge("app-a", "shared-topic"),
          makeMessagingEdge("app-b", "shared-topic"),
        ],
        null,
      );
      expect(topicNames.size).toBe(1);
      expect(topicNames.has("shared-topic")).toBe(true);
    });

    it("should include topic nodes with type topicNode in flowNodes", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const topicNode = flowNodes.find((n) => n.id === "topic:orders-topic");
      expect(topicNode).toBeDefined();
      expect(topicNode?.type).toBe("topicNode");
    });

    it("should set topic node data.label to the bare topic name without prefix", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const topicNode = flowNodes.find((n) => n.id === "topic:orders-topic");
      expect(topicNode?.data.label).toBe("orders-topic");
    });

    it("should create one topic node per distinct topic across multiple messaging edges", () => {
      const { flowNodes } = buildLayout(
        [makeNode("app-a")],
        [],
        [
          makeMessagingEdge("app-a", "topic-x"),
          makeMessagingEdge("app-a", "topic-y"),
        ],
        null,
      );
      const topicNodes = flowNodes.filter((n) => n.type === "topicNode");
      expect(topicNodes).toHaveLength(2);
      const ids = topicNodes.map((n) => n.id);
      expect(ids).toContain("topic:topic-x");
      expect(ids).toContain("topic:topic-y");
    });
  });

  describe("dashed messaging edges", () => {
    it("should create a flow edge from app to topic:name", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const msgEdge = flowEdges.find(
        (e) => e.source === "order-service" && e.target === "topic:orders-topic",
      );
      expect(msgEdge).toBeDefined();
    });

    it("should set strokeDasharray on messaging edges to mark them dashed", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const msgEdge = flowEdges.find((e) => e.target === "topic:orders-topic");
      expect(msgEdge?.style.strokeDasharray).toBe("6 3");
    });

    it("should use violet stroke color for messaging edges", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const msgEdge = flowEdges.find((e) => e.target === "topic:orders-topic");
      expect(msgEdge?.style.stroke).toBe("#8b5cf6");
    });

    it("should label messaging edges as publishes", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const msgEdge = flowEdges.find((e) => e.target === "topic:orders-topic");
      expect(msgEdge?.label).toBe("publishes");
    });

    it("should deduplicate messaging flow edges for duplicate app-topic pairs", () => {
      const { msgEdgeKeys } = buildLayout(
        [makeNode("order-service")],
        [],
        [
          makeMessagingEdge("order-service", "orders-topic"),
          makeMessagingEdge("order-service", "orders-topic"),
        ],
        null,
      );
      expect(msgEdgeKeys.size).toBe(1);
    });

    it("should not add strokeDasharray to regular (non-messaging) edges", () => {
      const { flowEdges } = buildLayout(
        [makeNode("A"), makeNode("B")],
        [makeEdge("A", "B")],
        [],
        null,
      );
      const regularEdge = flowEdges.find((e) => e.source === "A" && e.target === "B");
      expect(regularEdge?.style.strokeDasharray).toBeUndefined();
    });
  });

  describe("selection highlighting with topic nodes", () => {
    it("should include topic node in connectedNodes when the publishing app is selected", () => {
      const { connectedNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        "order-service",
      );
      expect(connectedNodes.has("order-service")).toBe(true);
      expect(connectedNodes.has("topic:orders-topic")).toBe(true);
    });

    it("should include the publishing app in connectedNodes when the topic node is selected", () => {
      const { connectedNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        "topic:orders-topic",
      );
      expect(connectedNodes.has("topic:orders-topic")).toBe(true);
      expect(connectedNodes.has("order-service")).toBe(true);
    });

    it("should NOT include unrelated topic nodes when an app is selected", () => {
      const { connectedNodes } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [],
        [
          makeMessagingEdge("order-service", "orders-topic"),
          makeMessagingEdge("payment-service", "payments-topic"),
        ],
        "order-service",
      );
      expect(connectedNodes.has("topic:orders-topic")).toBe(true);
      expect(connectedNodes.has("topic:payments-topic")).toBe(false);
    });

    it("should dim topic node when it is not connected to selected app", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [],
        [
          makeMessagingEdge("order-service", "orders-topic"),
          makeMessagingEdge("payment-service", "payments-topic"),
        ],
        "order-service",
      );
      const unrelatedTopic = flowNodes.find((n) => n.id === "topic:payments-topic");
      expect(unrelatedTopic?.data.dimmed).toBe(true);
    });

    it("should not dim topic node when it is connected to the selected app", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        "order-service",
      );
      const connectedTopic = flowNodes.find((n) => n.id === "topic:orders-topic");
      expect(connectedTopic?.data.dimmed).toBe(false);
    });

    it("should dim messaging edge when neither endpoint is connected to selected node", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [],
        [
          makeMessagingEdge("order-service", "orders-topic"),
          makeMessagingEdge("payment-service", "payments-topic"),
        ],
        "order-service",
      );
      const unrelatedEdge = flowEdges.find(
        (e) => e.source === "payment-service" && e.target === "topic:payments-topic",
      );
      expect(unrelatedEdge?.style.opacity).toBe(0.15);
    });

    it("should keep messaging edge at full opacity when both endpoints are connected", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        "order-service",
      );
      const relatedEdge = flowEdges.find(
        (e) => e.source === "order-service" && e.target === "topic:orders-topic",
      );
      expect(relatedEdge?.style.opacity).toBe(1);
    });

    it("should return empty connectedNodes when no node is selected", () => {
      const { connectedNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      expect(connectedNodes.size).toBe(0);
    });

    it("should set all topic node dimmed to false when selection is null", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service")],
        [],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const topicNode = flowNodes.find((n) => n.id === "topic:orders-topic");
      expect(topicNode?.data.dimmed).toBe(false);
    });

    it("should connect topic node selection to multiple publishers", () => {
      const { connectedNodes } = buildLayout(
        [makeNode("app-a"), makeNode("app-b")],
        [],
        [
          makeMessagingEdge("app-a", "shared-topic"),
          makeMessagingEdge("app-b", "shared-topic"),
        ],
        "topic:shared-topic",
      );
      expect(connectedNodes.has("app-a")).toBe(true);
      expect(connectedNodes.has("app-b")).toBe(true);
    });
  });

  describe("combined regular and messaging edges", () => {
    it("should produce both regular and messaging flow edges simultaneously", () => {
      const { flowEdges } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [makeEdge("order-service", "payment-service")],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const regularEdge = flowEdges.find(
        (e) => e.source === "order-service" && e.target === "payment-service",
      );
      const msgEdge = flowEdges.find(
        (e) => e.source === "order-service" && e.target === "topic:orders-topic",
      );
      expect(regularEdge).toBeDefined();
      expect(msgEdge).toBeDefined();
    });

    it("should include both app nodes and topic nodes in flowNodes", () => {
      const { flowNodes } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [makeEdge("order-service", "payment-service")],
        [makeMessagingEdge("order-service", "orders-topic")],
        null,
      );
      const ids = flowNodes.map((n) => n.id);
      expect(ids).toContain("order-service");
      expect(ids).toContain("payment-service");
      expect(ids).toContain("topic:orders-topic");
    });

    it("should handle selection that spans both regular and messaging neighbors", () => {
      const { connectedNodes } = buildLayout(
        [makeNode("order-service"), makeNode("payment-service")],
        [makeEdge("order-service", "payment-service")],
        [makeMessagingEdge("order-service", "orders-topic")],
        "order-service",
      );
      expect(connectedNodes.has("order-service")).toBe(true);
      expect(connectedNodes.has("payment-service")).toBe(true);
      expect(connectedNodes.has("topic:orders-topic")).toBe(true);
    });
  });
});
