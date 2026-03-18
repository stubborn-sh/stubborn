import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { WebhooksPage } from "@/features/webhooks";

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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WebhooksPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(screen.getByText("Manage webhook subscriptions for events")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should display webhook URLs after loading", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(await screen.findByText("https://hooks.example.com/contract")).toBeInTheDocument();
    expect(await screen.findByText("https://hooks.example.com/verification")).toBeInTheDocument();
  });

  it("should show event type badges", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(await screen.findByText("CONTRACT_PUBLISHED")).toBeInTheDocument();
    expect(await screen.findByText("VERIFICATION_FAILED")).toBeInTheDocument();
  });

  it("should show enabled status as YES badge", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(await screen.findByText("YES")).toBeInTheDocument();
  });

  it("should show disabled status as NO badge", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(await screen.findByText("NO")).toBeInTheDocument();
  });

  it("should show application name or Global", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("Global")).toBeInTheDocument();
  });

  it("should display table column headers", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("Application")).toBeInTheDocument();
      expect(screen.getByText("Event Type")).toBeInTheDocument();
      expect(screen.getByText("URL")).toBeInTheDocument();
      expect(screen.getByText("Enabled")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  it("should filter webhooks via server-side search", async () => {
    // arrange — override handler to return filtered results when search param is present
    server.use(
      http.get("/api/v1/webhooks", ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        if (search === "verification") {
          return HttpResponse.json({
            content: [
              {
                id: "w2",
                eventType: "VERIFICATION_FAILED",
                url: "https://hooks.example.com/verification",
                applicationName: null,
                enabled: false,
                createdAt: "2026-02-22T10:00:00Z",
                updatedAt: "2026-02-22T10:00:00Z",
              },
            ],
            number: 0,
            size: 100,
            totalElements: 1,
            totalPages: 1,
            first: true,
            last: true,
            empty: false,
          });
        }
        return HttpResponse.json({
          content: [
            {
              id: "w1",
              eventType: "CONTRACT_PUBLISHED",
              url: "https://hooks.example.com/contract",
              applicationName: "order-service",
              enabled: true,
              createdAt: "2026-02-22T10:00:00Z",
              updatedAt: "2026-02-22T10:00:00Z",
            },
            {
              id: "w2",
              eventType: "VERIFICATION_FAILED",
              url: "https://hooks.example.com/verification",
              applicationName: null,
              enabled: false,
              createdAt: "2026-02-22T10:00:00Z",
              updatedAt: "2026-02-22T10:00:00Z",
            },
          ],
          number: 0,
          size: 100,
          totalElements: 2,
          totalPages: 1,
          first: true,
          last: true,
          empty: false,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WebhooksPage />);

    // act — wait for data to load then type in search
    await screen.findByText("https://hooks.example.com/contract");
    const searchInput = screen.getByPlaceholderText("Search webhooks...");
    await user.type(searchInput, "verification");

    // assert — only verification webhook visible after server-side search
    await waitFor(() => {
      expect(screen.getByText("https://hooks.example.com/verification")).toBeInTheDocument();
      expect(screen.queryByText("https://hooks.example.com/contract")).not.toBeInTheDocument();
    });
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.get("/api/v1/webhooks", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    // act
    renderWithProviders(<WebhooksPage />);

    // assert
    expect(await screen.findByText("Failed to load webhooks")).toBeInTheDocument();
  });

  it("should show empty state when no webhooks exist", async () => {
    // arrange
    server.use(
      http.get("/api/v1/webhooks", () =>
        HttpResponse.json({
          content: [],
          number: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          first: true,
          last: true,
          empty: true,
        }),
      ),
    );

    // act
    renderWithProviders(<WebhooksPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should remove loading indicator after data loads", async () => {
    // arrange & act
    renderWithProviders(<WebhooksPage />);

    // assert — loading first
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // assert — loading disappears after data loads
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });
});
