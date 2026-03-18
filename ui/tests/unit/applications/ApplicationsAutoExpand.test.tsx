import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { ApplicationsPage } from "../../../src/features/applications";

/**
 * Adversarial tests for the auto-expand behavior when navigating with ?search= param.
 * Tests edge cases: collapsing, multiple results, empty results, special characters.
 */

const singleAppResponse = {
  content: [
    {
      id: "1",
      name: "order-service",
      description: "Order management",
      owner: "team-orders",
      mainBranch: "main",
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
};

const twoAppsResponse = {
  content: [
    {
      id: "1",
      name: "order-service",
      description: "Order management",
      owner: "team-orders",
      createdAt: "2026-01-15T10:00:00Z",
    },
    {
      id: "2",
      name: "order-service-v2",
      description: "Order management v2",
      owner: "team-orders",
      createdAt: "2026-01-16T10:00:00Z",
    },
  ],
  number: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
  empty: false,
};

const emptyResponse = {
  content: [],
  number: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
  empty: true,
};

const server = setupServer(
  http.get("/api/v1/applications", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    if (search === "order-service") return HttpResponse.json(singleAppResponse);
    if (search === "order") return HttpResponse.json(twoAppsResponse);
    if (search === "nonexistent") return HttpResponse.json(emptyResponse);
    return HttpResponse.json(twoAppsResponse);
  }),
  http.get("/api/v1/applications/:name", ({ params }) => {
    if (params.name === "order-service") {
      return HttpResponse.json(singleAppResponse.content[0]);
    }
    return new HttpResponse(null, { status: 404 });
  }),
  http.get("/api/v1/applications/:name/versions", () => HttpResponse.json(["1.0.0", "2.0.0"])),
);

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function renderWithProviders(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ApplicationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ApplicationsPage auto-expand edge cases", () => {
  it("should NOT auto-expand when search matches multiple results", async () => {
    // arrange & act — "order" matches 2 apps
    renderWithProviders("/applications?search=order");

    // assert — both apps visible but no detail expanded
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("order-service-v2")).toBeInTheDocument();
    expect(screen.queryByText("Published Versions")).not.toBeInTheDocument();
  });

  it("should NOT auto-expand when search matches zero results", async () => {
    // arrange & act
    renderWithProviders("/applications?search=nonexistent");

    // assert — empty table, no detail
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
    expect(screen.queryByText("Published Versions")).not.toBeInTheDocument();
  });

  it("should NOT auto-expand when there is no search param", async () => {
    // arrange & act — no search param, gets 2 results
    renderWithProviders("/applications");

    // assert — apps visible but no detail expanded
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(screen.queryByText("Published Versions")).not.toBeInTheDocument();
  });

  it("should allow user to collapse auto-expanded detail", async () => {
    const user = userEvent.setup();
    renderWithProviders("/applications?search=order-service");

    // wait for auto-expand
    expect(await screen.findByText("Published Versions (2)")).toBeInTheDocument();

    // user clicks the app name to collapse
    const appButton = screen.getByRole("button", { name: "order-service" });
    await user.click(appButton);

    // detail should be collapsed — auto-expand only fires once
    await waitFor(() => {
      expect(screen.queryByText("Published Versions (2)")).not.toBeInTheDocument();
    });
  });
});
