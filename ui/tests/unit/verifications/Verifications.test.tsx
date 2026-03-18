import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { VerificationsPage } from "@/features/verifications";

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

describe("VerificationsPage", () => {
  it("should render verifications heading", () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert
    expect(screen.getByText("Verifications")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should display verification table after loading", async () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert - "order-service" appears in both rows as provider, so use findAllByText
    const orderServiceElements = await screen.findAllByText("order-service", { exact: false });
    expect(orderServiceElements.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("payment-service", { exact: false })).toBeInTheDocument();
    expect(await screen.findByText("notification-service", { exact: false })).toBeInTheDocument();
  });

  it("should display table column headers", async () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Consumer")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Verified At")).toBeInTheDocument();
    });
  });

  it("should show SUCCESS status badge for successful verifications", async () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert
    expect(await screen.findByText("SUCCESS")).toBeInTheDocument();
  });

  it("should show FAILED status badge for failed verifications", async () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert
    expect(await screen.findByText("FAILED")).toBeInTheDocument();
  });

  it("should display provider and consumer version information", async () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert - versions are rendered inside spans with "v" prefix, use findAllByText
    // since "v1.0.0" appears in both provider columns (both verifications have provider version 1.0.0)
    const v1Elements = await screen.findAllByText(
      (_content, element) =>
        element !== null && element.tagName === "SPAN" && element.textContent === "v1.0.0",
    );
    expect(v1Elements.length).toBeGreaterThanOrEqual(1);
    const v2Elements = await screen.findAllByText(
      (_content, element) =>
        element !== null && element.tagName === "SPAN" && element.textContent === "v2.0.0",
    );
    expect(v2Elements.length).toBeGreaterThanOrEqual(1);
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.get("/api/v1/verifications", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    // act
    renderWithProviders(<VerificationsPage />);

    // assert
    expect(await screen.findByText("Failed to load verifications")).toBeInTheDocument();
  });

  it("should show empty state when no verifications exist", async () => {
    // arrange
    server.use(
      http.get("/api/v1/verifications", () =>
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
    renderWithProviders(<VerificationsPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should remove loading indicator after data loads", async () => {
    // arrange & act
    renderWithProviders(<VerificationsPage />);

    // assert - loading first
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // assert - loading disappears after data loads
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });
});
