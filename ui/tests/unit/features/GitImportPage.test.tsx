import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { GitImportPage } from "@/features/git-import";

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

describe("GitImportPage", () => {
  it("should render the heading", () => {
    renderWithProviders(<GitImportPage />);
    expect(screen.getByText("Git Import")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    renderWithProviders(<GitImportPage />);
    expect(screen.getByText("Import contracts from Git repositories")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    renderWithProviders(<GitImportPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should display git source repository URLs after loading", async () => {
    renderWithProviders(<GitImportPage />);
    expect(
      await screen.findByText("https://github.com/acme/order-service.git"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("https://github.com/acme/payment-service.git"),
    ).toBeInTheDocument();
  });

  it("should display application names", async () => {
    renderWithProviders(<GitImportPage />);
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("payment-service")).toBeInTheDocument();
  });

  it("should show sync status badges", async () => {
    renderWithProviders(<GitImportPage />);
    expect(await screen.findByText("ON")).toBeInTheDocument();
    expect(await screen.findByText("OFF")).toBeInTheDocument();
  });

  it("should display table column headers", async () => {
    renderWithProviders(<GitImportPage />);
    await waitFor(() => {
      expect(screen.getByText("Application")).toBeInTheDocument();
      expect(screen.getByText("Repository URL")).toBeInTheDocument();
      expect(screen.getByText("Branch")).toBeInTheDocument();
      expect(screen.getByText("Contracts Dir")).toBeInTheDocument();
      expect(screen.getByText("Sync")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  it("should show branch name or default", async () => {
    renderWithProviders(<GitImportPage />);
    expect(await screen.findByText("main")).toBeInTheDocument();
    expect(await screen.findByText("default")).toBeInTheDocument();
  });

  it("should show contracts directory or /", async () => {
    renderWithProviders(<GitImportPage />);
    expect(await screen.findByText("src/test/resources/contracts")).toBeInTheDocument();
    expect(await screen.findByText("/")).toBeInTheDocument();
  });

  it("should show Register Source form when button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GitImportPage />);
    await user.click(screen.getByText("Register Source"));
    expect(screen.getByText("Register Git Source")).toBeInTheDocument();
  });

  it("should show Import from Git form when button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GitImportPage />);
    await user.click(screen.getByText("Import from Git"));
    expect(
      screen.getByText("Import from Git", { selector: ".text-foreground" }),
    ).toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    server.use(
      http.get("/api/v1/import/git-sources", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
    renderWithProviders(<GitImportPage />);
    expect(await screen.findByText("Failed to load Git import sources")).toBeInTheDocument();
  });

  it("should show empty state when no sources exist", async () => {
    server.use(
      http.get("/api/v1/import/git-sources", () =>
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
    renderWithProviders(<GitImportPage />);
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should remove loading indicator after data loads", async () => {
    renderWithProviders(<GitImportPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });
});
