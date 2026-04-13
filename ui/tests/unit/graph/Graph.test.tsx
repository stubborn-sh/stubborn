import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";

// Mock @xyflow/react — jsdom can't handle DOM measurements required by React Flow
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    children,
    nodes,
    edges,
  }: {
    children?: React.ReactNode;
    nodes?: { id: string; data: Record<string, unknown> }[];
    edges?: { id: string }[];
    onNodeClick?: (e: React.MouseEvent, node: { id: string }) => void;
  }) => (
    <div data-testid="mock-react-flow">
      {nodes?.map((n) => (
        <div key={n.id} data-testid={`flow-node-${n.id}`}>
          {String(n.data.label)} ({String(n.data.owner)})
        </div>
      ))}
      {edges?.map((e) => (
        <div key={e.id} data-testid={`flow-edge-${e.id}`} />
      ))}
      {children}
    </div>
  ),
  Controls: () => <div data-testid="flow-controls" />,
  MiniMap: () => <div data-testid="flow-minimap" />,
  Background: () => <div data-testid="flow-background" />,
  BackgroundVariant: { Dots: "dots" },
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
}));

// Must import GraphPage after the mock is set up
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

describe("GraphPage", () => {
  it("should render dependencies heading", () => {
    renderWithProviders(<GraphPage />);
    expect(screen.getByText("Dependencies")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    renderWithProviders(<GraphPage />);
    expect(
      screen.getByText(
        "Service dependency graph derived from verifications and messaging contracts",
      ),
    ).toBeInTheDocument();
  });

  it("should show graph view by default with toggle buttons", () => {
    renderWithProviders(<GraphPage />);
    const graphTab = screen.getByRole("tab", { name: "Graph" });
    const tableTab = screen.getByRole("tab", { name: "Table" });
    expect(graphTab).toHaveAttribute("aria-selected", "true");
    expect(tableTab).toHaveAttribute("aria-selected", "false");
  });

  it("should show loading state initially in graph view", () => {
    renderWithProviders(<GraphPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render React Flow graph after loading", async () => {
    renderWithProviders(<GraphPage />);
    expect(await screen.findByTestId("dependency-graph")).toBeInTheDocument();
    expect(screen.getByTestId("mock-react-flow")).toBeInTheDocument();
  });

  it("should show nodes in graph view", async () => {
    renderWithProviders(<GraphPage />);
    expect(await screen.findByTestId("flow-node-order-service")).toBeInTheDocument();
    expect(screen.getByTestId("flow-node-payment-service")).toBeInTheDocument();
  });

  it("should switch to table view when Table tab clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />);

    const tableTab = screen.getByRole("tab", { name: "Table" });
    await user.click(tableTab);

    await waitFor(() => {
      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Consumer")).toBeInTheDocument();
    });
  });

  it("should show table view when URL has ?view=table", async () => {
    renderWithProviders(<GraphPage />, "/graph?view=table");

    await waitFor(() => {
      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Consumer")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });
  });

  it("should display table column headers in table view", async () => {
    renderWithProviders(<GraphPage />, "/graph?view=table");

    await waitFor(() => {
      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Consumer")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Verified At")).toBeInTheDocument();
    });
  });

  it("should show SUCCESS status badge in table view", async () => {
    renderWithProviders(<GraphPage />, "/graph?view=table");
    expect(await screen.findByText("SUCCESS")).toBeInTheDocument();
  });

  it("should show FAILED status badge in table view", async () => {
    renderWithProviders(<GraphPage />, "/graph?view=table");
    expect(await screen.findByText("FAILED")).toBeInTheDocument();
  });

  it("should display owner in node buttons in table view", async () => {
    renderWithProviders(<GraphPage />, "/graph?view=table");
    expect(await screen.findByText("(team-orders)")).toBeInTheDocument();
    expect(await screen.findByText("(team-payments)")).toBeInTheDocument();
  });

  it("should filter edges by search input in table view", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />, "/graph?view=table");

    await screen.findAllByText("order-service", { exact: false });
    const searchInput = screen.getByPlaceholderText("Filter by app name...");
    await user.type(searchInput, "notification");

    await waitFor(() => {
      expect(screen.getByText("notification-service", { exact: false })).toBeInTheDocument();
      const failedBadges = screen.getAllByText("FAILED");
      expect(failedBadges.length).toBe(1);
      expect(screen.queryByText("SUCCESS")).not.toBeInTheDocument();
    });
  });

  it("should show app detail view when node button clicked in table view", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />, "/graph?view=table");

    const orderButton = await screen.findByRole("button", {
      name: /order-service.*team-orders/,
    });
    await user.click(orderButton);

    expect(await screen.findByText("Depended on by (consumers)")).toBeInTheDocument();
  });

  it("should show clear selection button when app selected in table view", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />, "/graph?view=table");

    const orderButton = await screen.findByRole("button", {
      name: /order-service.*team-orders/,
    });
    await user.click(orderButton);

    expect(await screen.findByText("Clear selection")).toBeInTheDocument();
  });

  it("should return to full table view when clear selection clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage />, "/graph?view=table");
    const orderButton = await screen.findByRole("button", {
      name: /order-service.*team-orders/,
    });
    await user.click(orderButton);
    await screen.findByText("Clear selection");

    const clearButton = screen.getByText("Clear selection");
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText("SUCCESS")).toBeInTheDocument();
      expect(screen.getByText("FAILED")).toBeInTheDocument();
    });
  });

  it("should show error message when API fails", async () => {
    server.use(
      http.get("/api/v1/graph", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    renderWithProviders(<GraphPage />);
    expect(await screen.findByText("Failed to load dependency graph")).toBeInTheDocument();
  });

  it("should show empty state when no edges exist in graph view", async () => {
    server.use(http.get("/api/v1/graph", () => HttpResponse.json({ nodes: [], edges: [] })));

    renderWithProviders(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should show empty state when no edges exist in table view", async () => {
    server.use(http.get("/api/v1/graph", () => HttpResponse.json({ nodes: [], edges: [] })));

    renderWithProviders(<GraphPage />, "/graph?view=table");

    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });
});
