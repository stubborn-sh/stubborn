import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}-${position}`} />
  ),
  Position: { Left: "left", Right: "right" },
}));

import TopicNode from "@/features/graph/TopicNode";

function renderTopicNode(label: string, dimmed: boolean) {
  const props = {
    id: "test-node",
    data: { label, dimmed },
    type: "topic",
    selected: false,
    isConnectable: true,
    zIndex: 0,
    xPos: 0,
    yPos: 0,
    dragging: false,
    deletable: false,
    selectable: false,
    draggable: false,
  };
  return render(<TopicNode {...(props as never)} />);
}

describe("TopicNode", () => {
  it("should render topic label", () => {
    renderTopicNode("my-topic", false);
    expect(screen.getByText("my-topic")).toBeInTheDocument();
  });

  it("should render with dashed violet border", () => {
    const { container } = renderTopicNode("any", false);
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("border-dashed");
    expect(node.className).toContain("border-violet-500");
  });

  it("should render dimmed when dimmed=true", () => {
    const { container } = renderTopicNode("any", true);
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("opacity-30");
    expect(node.className).not.toContain("opacity-100");
  });

  it("should render full opacity when dimmed=false", () => {
    const { container } = renderTopicNode("any", false);
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain("opacity-100");
    expect(node.className).not.toContain("opacity-30");
  });

  it("should have left and right handles", () => {
    renderTopicNode("any", false);
    expect(screen.getByTestId("handle-target-left")).toBeInTheDocument();
    expect(screen.getByTestId("handle-source-right")).toBeInTheDocument();
  });
});
