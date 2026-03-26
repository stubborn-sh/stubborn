import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { ApplicationsPage } from "../../../src/features/applications";

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

function renderWithProviders(ui: React.ReactElement, initialRoute = "/applications") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Applications", () => {
  it("should render applications heading", () => {
    renderWithProviders(<ApplicationsPage />);
    expect(screen.getByText("Applications")).toBeInTheDocument();
  });

  it("should show applications after loading", async () => {
    renderWithProviders(<ApplicationsPage />);
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("payment-service")).toBeInTheDocument();
  });

  it("should show search input", () => {
    renderWithProviders(<ApplicationsPage />);
    expect(screen.getByPlaceholderText("Search applications...")).toBeInTheDocument();
  });

  it("should populate search from URL param", () => {
    renderWithProviders(<ApplicationsPage />, "/applications?search=order-service");
    const input = screen.getByPlaceholderText("Search applications...");
    expect(input).toHaveValue("order-service");
  });

  it("should auto-expand when URL search matches single result", async () => {
    // Override handler to return a single result when search matches
    server.use(
      http.get("/api/v1/applications", ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        if (search === "order-service") {
          return HttpResponse.json({
            content: [
              {
                id: "1",
                name: "order-service",
                description: "Order management",
                owner: "team-orders",
                createdAt: "2026-01-15T10:00:00Z",
              },
            ],
            number: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
            first: true,
            last: true,
            empty: false,
          });
        }
        return HttpResponse.json({
          content: [],
          number: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          first: true,
          last: true,
          empty: true,
        });
      }),
      http.get("/api/v1/applications/:name", ({ params }) => {
        if (params.name === "order-service") {
          return HttpResponse.json({
            id: "1",
            name: "order-service",
            description: "Order management",
            owner: "team-orders",
            mainBranch: "main",
            createdAt: "2026-01-15T10:00:00Z",
          });
        }
        return new HttpResponse(null, { status: 404 });
      }),
      http.get("/api/v1/applications/:name/versions", () => HttpResponse.json(["1.0.0", "2.0.0"])),
    );

    renderWithProviders(<ApplicationsPage />, "/applications?search=order-service");

    // Auto-expanded detail should show the detail card with Owner field
    expect(await screen.findByText("Published Versions (2)")).toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    server.use(
      http.get("/api/v1/applications", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    renderWithProviders(<ApplicationsPage />);
    expect(await screen.findByText("Failed to load applications")).toBeInTheDocument();
  });
});
