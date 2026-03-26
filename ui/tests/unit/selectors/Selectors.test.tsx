import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { SelectorsPage } from "@/features/selectors";

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

describe("SelectorsPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<SelectorsPage />);

    // assert
    expect(screen.getByText("Consumer Version Selectors")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    // arrange & act
    renderWithProviders(<SelectorsPage />);

    // assert
    expect(
      screen.getByText("Resolve which consumer contracts a provider should verify against"),
    ).toBeInTheDocument();
  });

  it("should render form with mode selector", () => {
    // arrange & act
    renderWithProviders(<SelectorsPage />);

    // assert
    expect(screen.getByLabelText("Mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve Selectors" })).toBeInTheDocument();
  });

  it("should show consumer name field when consumer mode selected", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.selectOptions(screen.getByLabelText("Mode"), "consumer");

    // assert
    expect(screen.getByText("Consumer Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Select consumer...")).toBeInTheDocument();
  });

  it("should show branch name field when branch mode selected", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.selectOptions(screen.getByLabelText("Mode"), "branch");

    // assert
    expect(screen.getByLabelText("Branch Name")).toBeInTheDocument();
  });

  it("should show environment field when deployed mode selected", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.selectOptions(screen.getByLabelText("Mode"), "deployed");

    // assert
    expect(screen.getByText("Environment (optional)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("All environments")).toBeInTheDocument();
  });

  it("should show results after submitting selector", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Resolve Selectors" }));

    // assert
    expect(await screen.findByText("Results")).toBeInTheDocument();
    expect(await screen.findByText("1 contract")).toBeInTheDocument();
  });

  it("should show resolved contract data in results table", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Resolve Selectors" }));

    // assert
    expect(await screen.findByText("payment-service")).toBeInTheDocument();
    expect(await screen.findByText("2.0.0")).toBeInTheDocument();
    expect(await screen.findByText("main")).toBeInTheDocument();
    expect(await screen.findByText("create-payment")).toBeInTheDocument();
  });

  it("should not show results before form submission", () => {
    // arrange & act
    renderWithProviders(<SelectorsPage />);

    // assert
    expect(screen.queryByText("Results")).not.toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.post("/api/v1/selectors/resolve", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Resolve Selectors" }));

    // assert
    expect(await screen.findByText("Failed to resolve selectors")).toBeInTheDocument();
  });

  it("should show empty message when no contracts match", async () => {
    // arrange
    server.use(http.post("/api/v1/selectors/resolve", () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<SelectorsPage />);

    // act
    await user.click(screen.getByRole("button", { name: "Resolve Selectors" }));

    // assert
    await waitFor(() => {
      expect(screen.getByText("0 contracts")).toBeInTheDocument();
      expect(screen.getByText("No contracts matched the selector criteria.")).toBeInTheDocument();
    });
  });
});
