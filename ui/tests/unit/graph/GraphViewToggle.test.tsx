import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { handlers } from "../../mocks/handlers";

/**
 * Adversarial tests for GraphPage view toggle behavior.
 * Tests state leaks between views, empty states, and rapid switching.
 */

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    edges,
    onNodeClick,
  }: {
    children?: React.ReactNode;
    nodes?: { id: string; data: Record<string, unknown> }[];
    edges?: { id: string }[];
    onNodeClick?: (e: React.MouseEvent, node: { id: string }) => void;
  }) => (
    <div data-testid="mock-react-flow">
      {nodes?.map((n) => (
        <button
          key={n.id}
          data-testid={`flow-node-${n.id}`}
          onClick={(e) => onNodeClick?.(e as unknown as React.MouseEvent, n as { id: string })}
        >
          {String(n.data.label)}
        </button>
      ))}
      {edges?.map((e) => (
        <div key={e.id} data-testid={`flow-edge-${e.id}`} />
      ))}
      {children}
    </div>
  ),
  Controls: () => null,
  MiniMap: () => null,
  Background: () => null,
  BackgroundVariant: { Dots: "dots" },
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
}));

const { GraphPage } = await import("@/features/graph");

const server = setupServer(...handlers);
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function renderWithProviders(ui: React.ReactElement, initialRoute = "/graph") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GraphPage view toggle edge cases", () => {
  it("should clear selectedApp when switching from table view to graph view", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />, "/graph?view=table");

    // Select app in table view
    const orderButton = await screen.findByRole("button", {
      name: /order-service.*team-orders/,
    });
    await user.click(orderButton);

    // Verify detail panel shows in table view
    expect(await screen.findByText("Depended on by (consumers)")).toBeInTheDocument();

    // Switch to graph view
    const graphTab = screen.getByRole("tab", { name: "Graph" });
    await user.click(graphTab);

    // Selection should be cleared — no detail panel leaks into graph view
    await waitFor(() => {
      expect(screen.getByTestId("dependency-graph")).toBeInTheDocument();
    });
    expect(screen.queryByText("Depended on by (consumers)")).not.toBeInTheDocument();
  });

  it("should handle rapid view switching without crashes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />);

    await screen.findByTestId("dependency-graph");

    // Rapid toggle
    const tableTab = screen.getByRole("tab", { name: "Table" });
    const graphTab = screen.getByRole("tab", { name: "Graph" });

    await user.click(tableTab);
    await user.click(graphTab);
    await user.click(tableTab);
    await user.click(graphTab);

    // Should not crash, graph should be visible
    expect(screen.getByTestId("dependency-graph")).toBeInTheDocument();
  });

  it("should show graph view for unknown view param values", () => {
    // ?view=invalid should default to graph
    renderWithProviders(<GraphPage />, "/graph?view=invalid");
    const graphTab = screen.getByRole("tab", { name: "Graph" });
    expect(graphTab).toHaveAttribute("aria-selected", "true");
  });

  it("should show graph view for empty view param", () => {
    renderWithProviders(<GraphPage />, "/graph?view=");
    const graphTab = screen.getByRole("tab", { name: "Graph" });
    expect(graphTab).toHaveAttribute("aria-selected", "true");
  });
});
