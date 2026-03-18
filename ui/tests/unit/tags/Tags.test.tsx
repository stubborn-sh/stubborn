import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { TagsPage } from "@/features/tags";

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

async function selectApp(user: ReturnType<typeof userEvent.setup>) {
  const appCombo = screen.getByPlaceholderText("Select application");
  await user.click(appCombo);
  await user.click(await screen.findByText("order-service"));
}

async function selectVersion(user: ReturnType<typeof userEvent.setup>) {
  const versionCombo = await screen.findByPlaceholderText("Select version");
  await user.click(versionCombo);
  await user.click(await screen.findByText("1.0.0"));
}

describe("TagsPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<TagsPage />);

    // assert
    expect(screen.getByText("Version Tags")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    // arrange & act
    renderWithProviders(<TagsPage />);

    // assert
    expect(screen.getByText("Look up tags for a specific application version")).toBeInTheDocument();
  });

  it("should render form with application and version combo boxes", async () => {
    // arrange & act
    renderWithProviders(<TagsPage />);

    // assert
    expect(screen.getByPlaceholderText("Select application")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Select app first")).toBeInTheDocument();
    });
  });

  it("should render a Look up tags button", () => {
    // arrange & act
    renderWithProviders(<TagsPage />);

    // assert
    expect(screen.getByRole("button", { name: "Look up tags" })).toBeInTheDocument();
  });

  it("should disable button when fields are empty", () => {
    // arrange & act
    renderWithProviders(<TagsPage />);

    // assert
    const button = screen.getByRole("button", { name: "Look up tags" });
    expect(button).toBeDisabled();
  });

  it("should enable button when both fields are filled", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<TagsPage />);

    // act
    await selectApp(user);
    await selectVersion(user);

    // assert
    const button = screen.getByRole("button", { name: "Look up tags" });
    expect(button).toBeEnabled();
  });

  it("should show tags after submitting lookup form", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<TagsPage />);

    // act
    await selectApp(user);
    await selectVersion(user);
    await user.click(screen.getByRole("button", { name: "Look up tags" }));

    // assert
    expect(await screen.findByText("RELEASE")).toBeInTheDocument();
    expect(await screen.findByText("STABLE")).toBeInTheDocument();
  });

  it("should display table column headers after lookup", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<TagsPage />);

    // act
    await selectApp(user);
    await selectVersion(user);
    await user.click(screen.getByRole("button", { name: "Look up tags" }));

    // assert
    await waitFor(() => {
      expect(screen.getByText("Tag")).toBeInTheDocument();
      expect(screen.getByText("Created At")).toBeInTheDocument();
    });
  });

  it("should not show tags before form submission", () => {
    // arrange & act
    renderWithProviders(<TagsPage />);

    // assert
    expect(screen.queryByText("RELEASE")).not.toBeInTheDocument();
    expect(screen.queryByText("STABLE")).not.toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.get("/api/v1/applications/:name/versions/:version/tags", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<TagsPage />);

    // act
    await selectApp(user);
    await selectVersion(user);
    await user.click(screen.getByRole("button", { name: "Look up tags" }));

    // assert
    expect(await screen.findByText("Failed to load tags")).toBeInTheDocument();
  });

  it("should show empty state when no tags exist", async () => {
    // arrange
    server.use(
      http.get("/api/v1/applications/:name/versions/:version/tags", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderWithProviders(<TagsPage />);

    // act
    await selectApp(user);
    await selectVersion(user);
    await user.click(screen.getByRole("button", { name: "Look up tags" }));

    // assert
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });
});
