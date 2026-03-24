import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import DashboardPage from "../../../src/features/dashboard/DashboardPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  mockNavigate.mockClear();
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

describe("Dashboard", () => {
  it("should render dashboard heading", () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("should show application count after loading", async () => {
    renderWithProviders(<DashboardPage />);
    const elements = await screen.findAllByText("2");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("should show recent verifications", async () => {
    renderWithProviders(<DashboardPage />);
    const elements = await screen.findAllByText("order-service");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("should navigate to verifications with provider search on row click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    // Wait for recent verifications data to load (order-service appears in verification rows)
    const providerLinks = await screen.findAllByText("order-service");
    // Find the verification row: a div[role="button"] ancestor with cursor-pointer
    const row = providerLinks
      .map((el) => el.closest("[role='button']"))
      .find((el) => el?.className.includes("cursor-pointer"));
    expect(row).toBeTruthy();
    if (row) await user.click(row);

    expect(mockNavigate).toHaveBeenCalledWith("/verifications?search=order-service");
  });

  it("should show Dependency Graph heading", async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Dependency Graph")).toBeInTheDocument();
  });

  it("should show graph edges in the dependency graph widget", async () => {
    renderWithProviders(<DashboardPage />);
    // Graph mock data has edges with order-service as provider
    const providerCells = await screen.findAllByText("order-service");
    expect(providerCells.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("View full graph")).toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    server.use(
      http.get("/api/v1/applications", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
      http.get("/api/v1/verifications", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Failed to load dashboard data")).toBeInTheDocument();
  });
});
