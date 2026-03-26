import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { MatrixPage } from "@/features/matrix";

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

describe("MatrixPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(screen.getByText("Compatibility Matrix")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(screen.getByText("Cross-provider/consumer verification status")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should display provider and consumer names after loading", async () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    const orderElements = await screen.findAllByText("order-service", { exact: false });
    expect(orderElements.length).toBeGreaterThanOrEqual(1);
    const paymentElements = await screen.findAllByText("payment-service", { exact: false });
    expect(paymentElements.length).toBeGreaterThanOrEqual(1);
    const notificationElements = await screen.findAllByText("notification-service", {
      exact: false,
    });
    expect(notificationElements.length).toBeGreaterThanOrEqual(1);
  });

  it("should show SUCCESS status badge", async () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(await screen.findByText("SUCCESS")).toBeInTheDocument();
  });

  it("should show FAILED status badge", async () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(await screen.findByText("FAILED")).toBeInTheDocument();
  });

  it("should show branch info", async () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(await screen.findByText("main")).toBeInTheDocument();
    expect(await screen.findByText("feature/alerts")).toBeInTheDocument();
  });

  it("should display table column headers", async () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert — use getAllByText since labels and headers share text
    await waitFor(() => {
      const providerEls = screen.getAllByText("Provider");
      expect(providerEls.length).toBeGreaterThanOrEqual(1);
      const consumerEls = screen.getAllByText("Consumer");
      expect(consumerEls.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Branch")).toBeInTheDocument();
      expect(screen.getByText("Verified At")).toBeInTheDocument();
    });
  });

  it("should filter entries by search input", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<MatrixPage />);

    // act — wait for data to load then type in search
    await screen.findByText("SUCCESS");
    const searchInput = screen.getByPlaceholderText("Filter results...");
    await user.type(searchInput, "notification");

    // assert — only notification-service entry visible
    await waitFor(() => {
      expect(screen.getByText("notification-service", { exact: false })).toBeInTheDocument();
      expect(screen.queryByText("SUCCESS")).not.toBeInTheDocument();
      expect(screen.getByText("FAILED")).toBeInTheDocument();
    });
  });

  it("should show provider and consumer filter combo boxes", () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(screen.getByPlaceholderText("All providers")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("All consumers")).toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.get("/api/v1/matrix", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    // act
    renderWithProviders(<MatrixPage />);

    // assert
    expect(await screen.findByText("Failed to load compatibility matrix")).toBeInTheDocument();
  });

  it("should show empty state when no entries exist", async () => {
    // arrange
    server.use(http.get("/api/v1/matrix", () => HttpResponse.json([])));

    // act
    renderWithProviders(<MatrixPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should remove loading indicator after data loads", async () => {
    // arrange & act
    renderWithProviders(<MatrixPage />);

    // assert — loading first
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // assert — loading disappears after data loads
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });
});
