import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers, mockContracts } from "../../mocks/handlers";
import { ContractsPage } from "@/features/contracts";

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

/** Select app via ComboBox, wait for versions to load, then select version. */
async function selectAppAndVersion(user: ReturnType<typeof userEvent.setup>) {
  // ComboBox renders as text input — find the app input by placeholder
  const inputs = screen.getAllByRole("combobox");
  const appInput = inputs[0];

  // Click to open dropdown, then wait for options
  await user.click(appInput);
  await screen.findByText("order-service");
  // Select order-service from dropdown
  await user.click(screen.getByText("order-service"));

  // Wait for version ComboBox to be enabled and populated
  const versionInput = inputs[1];
  await waitFor(() => {
    expect(versionInput).not.toBeDisabled();
  });
  await user.click(versionInput);
  await screen.findByText("1.0.0");
  await user.click(screen.getByText("1.0.0"));
}

describe("ContractsPage", () => {
  it("should render contracts heading", () => {
    // arrange & act
    renderWithProviders(<ContractsPage />);

    // assert
    expect(screen.getByText("Contracts")).toBeInTheDocument();
  });

  it("should render application and version ComboBox inputs", () => {
    // arrange & act
    renderWithProviders(<ContractsPage />);

    // assert
    expect(screen.getByPlaceholderText("Select application")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Select app first")).toBeInTheDocument();
  });

  it("should populate application dropdown after loading", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act - click on app input to open dropdown
    const appInput = screen.getByPlaceholderText("Select application");
    await user.click(appInput);

    // assert
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("payment-service")).toBeInTheDocument();
  });

  it("should display contracts after selecting app and version", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act
    await selectAppAndVersion(user);

    // assert
    expect(await screen.findByText("create-order")).toBeInTheDocument();
    expect(await screen.findByText("get-order")).toBeInTheDocument();
  });

  it("should show table headers for contract data", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act
    await selectAppAndVersion(user);

    // assert
    await waitFor(() => {
      expect(screen.getByText("Contract")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Created")).toBeInTheDocument();
    });
  });

  it("should show JsonViewer when clicking on a contract name", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act
    await selectAppAndVersion(user);

    // wait for contracts to load and click the first contract
    const contractLink = await screen.findByText("create-order");
    await user.click(contractLink);

    // assert - JSON content should be displayed (formatted)
    await waitFor(() => {
      expect(screen.getByText(/"request"/)).toBeInTheDocument();
    });
  });

  it("should toggle JsonViewer off when clicking contract name again", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act
    await selectAppAndVersion(user);

    const contractLink = await screen.findByText("create-order");
    await user.click(contractLink);

    // assert - content is visible
    await waitFor(() => {
      expect(screen.getByText(/"request"/)).toBeInTheDocument();
    });

    // act - click again to collapse
    await user.click(contractLink);

    // assert - JSON content should be gone
    await waitFor(() => {
      expect(screen.queryByText(/"request"/)).not.toBeInTheDocument();
    });
  });

  it("should not fetch contracts until both app and version are provided", () => {
    // arrange & act
    renderWithProviders(<ContractsPage />);

    // assert - no table, no loading, no contracts
    expect(screen.queryByText("create-order")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("should handle empty contracts list", async () => {
    // arrange - override handler to return empty array
    server.use(
      http.get("/api/v1/applications/:name/versions/:version/contracts", () =>
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
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act
    await selectAppAndVersion(user);

    // assert - DataTable shows empty state
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should display content type for each contract", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<ContractsPage />);

    // act
    await selectAppAndVersion(user);

    // assert
    expect(await screen.findByText(mockContracts[0].contentType)).toBeInTheDocument();
    expect(await screen.findByText(mockContracts[1].contentType)).toBeInTheDocument();
  });

  it("should show fallback when applications API fails", async () => {
    // arrange — override applications to return 500
    server.use(
      http.get("/api/v1/applications", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    // act
    renderWithProviders(<ContractsPage />);

    // assert — heading still renders, no crash
    expect(screen.getByText("Contracts")).toBeInTheDocument();
    // No application options should load — wait a tick for the error state
    await waitFor(() => {
      expect(screen.queryByText("order-service")).not.toBeInTheDocument();
    });
  });
});
