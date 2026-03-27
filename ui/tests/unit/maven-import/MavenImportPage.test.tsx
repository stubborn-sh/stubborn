import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../mocks/handlers";
import { MavenImportPage } from "@/features/maven-import";

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

describe("MavenImportPage", () => {
  it("should render the heading", () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(screen.getByText("Maven Import")).toBeInTheDocument();
  });

  it("should render subtitle text", () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(screen.getByText("Import contracts from Maven repositories")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should display source repository URLs after loading", async () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(await screen.findByText("https://repo.maven.apache.org/maven2")).toBeInTheDocument();
    expect(
      await screen.findByText("https://nexus.internal.com/repository/releases"),
    ).toBeInTheDocument();
  });

  it("should display group IDs and artifact IDs", async () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(await screen.findByText("com.example")).toBeInTheDocument();
    expect(await screen.findByText("order-contracts")).toBeInTheDocument();
    expect(await screen.findByText("com.acme")).toBeInTheDocument();
    expect(await screen.findByText("payment-stubs")).toBeInTheDocument();
  });

  it("should show sync enabled status as YES/NO badges", async () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(await screen.findByText("YES")).toBeInTheDocument();
    expect(await screen.findByText("NO")).toBeInTheDocument();
  });

  it("should display table column headers", async () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("Repository URL")).toBeInTheDocument();
      expect(screen.getByText("Group ID")).toBeInTheDocument();
      expect(screen.getByText("Artifact ID")).toBeInTheDocument();
      expect(screen.getByText("Sync Enabled")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  it("should show register source form when button is clicked", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<MavenImportPage />);

    // act
    await user.click(screen.getByText("Register Source"));

    // assert
    expect(screen.getByText("Register Maven Source")).toBeInTheDocument();
  });

  it("should show import JAR form when button is clicked", async () => {
    // arrange
    const user = userEvent.setup();
    renderWithProviders(<MavenImportPage />);

    // act
    await user.click(screen.getByText("Import JAR"));

    // assert
    expect(screen.getByText("Import JAR", { selector: "h4" })).toBeInTheDocument();
  });

  it("should show error message when API fails", async () => {
    // arrange
    server.use(
      http.get("/api/v1/import/sources", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    // act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(await screen.findByText("Failed to load Maven import sources")).toBeInTheDocument();
  });

  it("should show empty state when no sources exist", async () => {
    // arrange
    server.use(
      http.get("/api/v1/import/sources", () =>
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
    renderWithProviders(<MavenImportPage />);

    // assert
    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should remove loading indicator after data loads", async () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert - loading first
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // assert - loading disappears after data loads
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  it("should show last synced version or Never", async () => {
    // arrange & act
    renderWithProviders(<MavenImportPage />);

    // assert
    expect(await screen.findByText("1.2.0")).toBeInTheDocument();
    expect(await screen.findByText("Never")).toBeInTheDocument();
  });
});
