import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { CleanupPage } from "@/features/cleanup";

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

describe("CleanupPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<CleanupPage />);

    // assert
    expect(screen.getByText("Data Cleanup")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    // arrange & act
    renderWithProviders(<CleanupPage />);

    // assert
    expect(
      screen.getByText("Remove old contract versions to keep the broker tidy"),
    ).toBeInTheDocument();
  });

  it("should render form with all inputs", () => {
    // arrange & act
    renderWithProviders(<CleanupPage />);

    // assert
    expect(screen.getByLabelText("Application Name (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Keep Latest Versions")).toBeInTheDocument();
    expect(screen.getByLabelText("Protected Environments")).toBeInTheDocument();
  });

  it("should render a Run Cleanup button", () => {
    // arrange & act
    renderWithProviders(<CleanupPage />);

    // assert
    expect(screen.getByRole("button", { name: "Run Cleanup" })).toBeInTheDocument();
  });

  it("should have default value of 5 for keep latest versions", () => {
    // arrange & act
    renderWithProviders(<CleanupPage />);

    // assert
    expect(screen.getByLabelText("Keep Latest Versions")).toHaveValue(5);
  });

  it("should show result after submitting cleanup", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CleanupPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Run Cleanup" }));

    // assert
    expect(await screen.findByText("Result")).toBeInTheDocument();
    expect(await screen.findByText("3 deleted")).toBeInTheDocument();
  });

  it("should show deleted contracts in result", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CleanupPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Run Cleanup" }));

    // assert
    expect(await screen.findByText("app:0.1.0:contract-a")).toBeInTheDocument();
    expect(await screen.findByText("app:0.2.0:contract-b")).toBeInTheDocument();
    expect(await screen.findByText("app:0.3.0:contract-c")).toBeInTheDocument();
  });

  it("should not show results before form submission", () => {
    // arrange & act
    renderWithProviders(<CleanupPage />);

    // assert
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.post("/api/v1/maintenance/cleanup", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CleanupPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Run Cleanup" }));

    // assert
    expect(await screen.findByText("Cleanup failed")).toBeInTheDocument();
  });

  it("should show zero deleted message when nothing to clean", async () => {
    // arrange
    server.use(
      http.post("/api/v1/maintenance/cleanup", () =>
        HttpResponse.json({ deletedCount: 0, deletedContracts: [] }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CleanupPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Run Cleanup" }));

    // assert
    await waitFor(() => {
      expect(screen.getByText("0 deleted")).toBeInTheDocument();
      expect(screen.getByText("No contracts were deleted.")).toBeInTheDocument();
    });
  });
});
