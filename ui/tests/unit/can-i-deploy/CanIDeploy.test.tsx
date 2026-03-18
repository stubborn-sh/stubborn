import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers, mockCanIDeployUnsafe } from "../../mocks/handlers";
import { CanIDeployPage } from "@/features/can-i-deploy";

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

/** Fill form: select app/version via ComboBox, select environment via native select. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  opts: { version?: string; env?: string } = {},
) {
  const version = opts.version ?? "1.0.0";
  const env = opts.env ?? "staging";

  // App and version are ComboBox inputs
  const inputs = screen.getAllByRole("combobox");
  const appInput = inputs[0];
  const versionInput = inputs[1];

  // Select application
  await user.click(appInput);
  await screen.findByText("order-service");
  await user.click(screen.getByText("order-service"));

  // Wait for version ComboBox to be enabled and select version
  await waitFor(() => {
    expect(versionInput).not.toBeDisabled();
  });
  await user.click(versionInput);
  await screen.findByText(version);
  await user.click(screen.getByText(version));

  // Environment is a native select
  const envSelect = screen.getByLabelText("Environment");
  await user.selectOptions(envSelect, env);
}

describe("CanIDeployPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<CanIDeployPage />);

    // assert
    expect(screen.getByText("Can I Deploy?")).toBeInTheDocument();
  });

  it("should render form with application, version, and environment inputs", () => {
    // arrange & act
    renderWithProviders(<CanIDeployPage />);

    // assert
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("Environment")).toBeInTheDocument();
  });

  it("should render a Check button", () => {
    // arrange & act
    renderWithProviders(<CanIDeployPage />);

    // assert
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
  });

  it("should disable Check button when fields are empty", () => {
    // arrange & act
    renderWithProviders(<CanIDeployPage />);

    // assert
    const checkButton = screen.getByRole("button", { name: "Check" });
    expect(checkButton).toBeDisabled();
  });

  it("should enable Check button when all fields are filled", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user);

    // assert
    const checkButton = screen.getByRole("button", { name: "Check" });
    expect(checkButton).toBeEnabled();
  });

  it("should show SAFE result with green badge after submitting", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Check" }));

    // assert
    expect(await screen.findByText("SAFE")).toBeInTheDocument();
    expect(await screen.findByText("Result")).toBeInTheDocument();
  });

  it("should display application, version, and environment in result", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Check" }));

    // assert - result details shown in summary line
    await waitFor(() => {
      expect(screen.getByText(/order-service.*v1\.0\.0.*staging/)).toBeInTheDocument();
    });
  });

  it("should show consumer results with verified status", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Check" }));

    // assert
    expect(await screen.findByText("Consumer Results:")).toBeInTheDocument();
    const paymentElements = await screen.findAllByText("payment-service");
    expect(paymentElements.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("SUCCESS")).toBeInTheDocument();
  });

  it("should show UNSAFE result with failed consumers", async () => {
    // arrange - override can-i-deploy to return unsafe
    server.use(http.get("/api/v1/can-i-deploy", () => HttpResponse.json(mockCanIDeployUnsafe)));
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user, { version: "2.0.0", env: "production" });
    await user.click(screen.getByRole("button", { name: "Check" }));

    // assert
    expect(await screen.findByText("UNSAFE")).toBeInTheDocument();
    expect(await screen.findByText("notification-service")).toBeInTheDocument();
  });

  it("should show FAILED badge for unverified consumers in unsafe result", async () => {
    // arrange
    server.use(http.get("/api/v1/can-i-deploy", () => HttpResponse.json(mockCanIDeployUnsafe)));
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user, { version: "2.0.0", env: "production" });
    await user.click(screen.getByRole("button", { name: "Check" }));

    // assert - should have both SUCCESS and FAILED badges in consumer results
    await waitFor(() => {
      const badges = screen.getAllByText("FAILED");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should handle API error during check", async () => {
    // arrange
    server.use(
      http.get("/api/v1/can-i-deploy", () =>
        HttpResponse.json({ message: "Server Error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Check" }));

    // assert - error from fetchJson includes status code
    expect(await screen.findByText(/API error: 500/)).toBeInTheDocument();
  });

  it("should not show results before form submission", () => {
    // arrange & act
    renderWithProviders(<CanIDeployPage />);

    // assert
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
    expect(screen.queryByText("SAFE")).not.toBeInTheDocument();
    expect(screen.queryByText("UNSAFE")).not.toBeInTheDocument();
  });

  it("should populate application ComboBox from API", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<CanIDeployPage />);

    // act - click on app input to open dropdown
    const inputs = screen.getAllByRole("combobox");
    await user.click(inputs[0]);

    // assert
    expect(await screen.findByText("order-service")).toBeInTheDocument();
    expect(await screen.findByText("payment-service")).toBeInTheDocument();
  });

  it("should show environment options from API in dropdown", async () => {
    // arrange & act
    renderWithProviders(<CanIDeployPage />);

    // assert — environment options loaded from /api/v1/environments
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).toContain("dev");
      expect(optionTexts).toContain("staging");
      expect(optionTexts).toContain("production");
    });
  });
});
