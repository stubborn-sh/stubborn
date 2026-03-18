import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import CustomNode from "./CustomNode";
import type { DependencyNode, DependencyEdge } from "@/api/types";

interface DependencyGraphProps {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  onNodeSelect: (name: string | null) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const nodeTypes = { appNode: CustomNode };

function buildLayout(
  graphNodes: DependencyNode[],
  graphEdges: DependencyEdge[],
  selectedNode: string | null,
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 60 });

  graphNodes.forEach((n) => {
    g.setNode(n.applicationName, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

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
  uniqueEdges.forEach((e) => {
    g.setEdge(e.providerName, e.consumerName);
  });

  dagre.layout(g);

  // Determine which nodes are connected to the selected node
  const connectedNodes = new Set<string>();
  if (selectedNode) {
    connectedNodes.add(selectedNode);
    uniqueEdges.forEach((e) => {
      if (e.providerName === selectedNode) connectedNodes.add(e.consumerName);
      if (e.consumerName === selectedNode) connectedNodes.add(e.providerName);
    });
  }

  // Determine node health (all edges SUCCESS = healthy)
  const nodeHealth = new Map<string, boolean>();
  graphNodes.forEach((n) => nodeHealth.set(n.applicationName, true));
  uniqueEdges.forEach((e) => {
    if (e.status === "FAILED") {
      nodeHealth.set(e.providerName, false);
      nodeHealth.set(e.consumerName, false);
    }
  });

  const flowNodes: Node[] = graphNodes.map((n) => {
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

  const flowEdges: Edge[] = uniqueEdges.map((e) => ({
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
    labelStyle: { fontSize: 10, fill: "#64748b" },
    labelBgStyle: { fill: "var(--color-card, #fff)", fillOpacity: 0.8 },
  }));

  return { flowNodes, flowEdges };
}

export default function DependencyGraph({
  nodes: gNodes,
  edges: gEdges,
  onNodeSelect,
}: DependencyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { flowNodes, flowEdges } = useMemo(
    () => buildLayout(gNodes, gEdges, selectedNode),
    [gNodes, gEdges, selectedNode],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync when layout recalculates
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const name = selectedNode === node.id ? null : node.id;
      setSelectedNode(name);
      onNodeSelect(name);
    },
    [selectedNode, onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div
      className="h-[500px] w-full rounded-lg border border-border bg-card"
      data-testid="dependency-graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { healthy?: boolean };
            return d.healthy ? "#10b981" : "#ef4444";
          }}
          className="!bg-background"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
