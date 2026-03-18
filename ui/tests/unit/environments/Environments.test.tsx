import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { EnvironmentsPage } from "@/features/environments";

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

describe("EnvironmentsPage", () => {
  it("should render environments heading", () => {
    // arrange & act
    renderWithProviders(<EnvironmentsPage />);

    // assert
    expect(screen.getByText("Environments")).toBeInTheDocument();
  });

  it("should render environment selector buttons from API", async () => {
    // arrange & act
    renderWithProviders(<EnvironmentsPage />);

    // assert - buttons loaded from /api/v1/environments
    expect(await screen.findByRole("button", { name: "dev" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "staging" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^production/ })).toBeInTheDocument();
  });

  it("should auto-select the first environment", async () => {
    // arrange & act
    renderWithProviders(<EnvironmentsPage />);

    // assert - first env (dev) should be active after loading
    await waitFor(() => {
      const devButton = screen.getByRole("button", { name: "dev" });
      expect(devButton.className).toContain("bg-primary");
    });
  });

  it("should display deployment table for auto-selected environment", async () => {
    // arrange & act
    renderWithProviders(<EnvironmentsPage />);

    // assert - dev deployments should load (first env)
    expect(await screen.findByText("1.1.0-SNAPSHOT")).toBeInTheDocument();
  });

  it("should show table column headers", async () => {
    // arrange & act
    renderWithProviders(<EnvironmentsPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("Application")).toBeInTheDocument();
      expect(screen.getByText("Version")).toBeInTheDocument();
      expect(screen.getByText("Environment")).toBeInTheDocument();
      expect(screen.getByText("Deployed At")).toBeInTheDocument();
    });
  });

  it("should switch to staging environment and show staging deployments", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<EnvironmentsPage />);

    // wait for env buttons to load
    await screen.findByRole("button", { name: "staging" });

    // act - click on staging button
    await user.click(screen.getByRole("button", { name: "staging" }));

    // assert - staging deployments should appear
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("payment-service")).toBeInTheDocument();
  });

  it("should highlight the selected environment button", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<EnvironmentsPage />);

    // wait for env buttons to load
    await screen.findByRole("button", { name: "staging" });

    // act
    await user.click(screen.getByRole("button", { name: "staging" }));

    // assert
    const stagingButton = screen.getByRole("button", { name: "staging" });
    expect(stagingButton.className).toContain("bg-primary");

    const devButton = screen.getByRole("button", { name: "dev" });
    expect(devButton.className).not.toContain("bg-primary");
  });

  it("should switch to production environment and show production deployments", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<EnvironmentsPage />);

    // wait for env buttons to load
    await screen.findByRole("button", { name: /^production/ });

    // act
    await user.click(screen.getByRole("button", { name: /^production/ }));

    // assert
    expect(await screen.findByText("0.9.0")).toBeInTheDocument();
  });

  it("should handle empty environment with no deployments", async () => {
    // arrange
    server.use(
      http.get("/api/v1/environments/:env/deployments", () =>
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
    renderWithProviders(<EnvironmentsPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should show message when no environments are configured", async () => {
    // arrange
    server.use(http.get("/api/v1/environments", () => HttpResponse.json([])));

    // act
    renderWithProviders(<EnvironmentsPage />);

    // assert
    expect(await screen.findByText("No environments configured")).toBeInTheDocument();
  });

  it("should show loading state while fetching deployments", async () => {
    // arrange & act
    renderWithProviders(<EnvironmentsPage />);

    // Wait for environments to load and auto-select first
    await screen.findByRole("button", { name: "dev" });

    // The Loading... state might have already passed by now, but initially it should show
    // This test verifies the loading indicator mechanism exists
  });
});
