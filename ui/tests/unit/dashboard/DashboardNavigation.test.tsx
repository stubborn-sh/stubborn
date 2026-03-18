import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import DashboardPage from "../../../src/features/dashboard/DashboardPage";

/**
 * Adversarial tests for Dashboard navigation behavior.
 * Tests special characters in names, clicking app links vs rows, and edge cases.
 */

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const makeVerification = (id: string, provider: string, consumer: string) => ({
  id,
  providerName: provider,
  providerVersion: "1.0.0",
  consumerName: consumer,
  consumerVersion: "2.0.0",
  status: "SUCCESS",
  details: null,
  verifiedAt: "2026-02-01T10:00:00Z",
});

function setupServerWithVerifications(verifications: ReturnType<typeof makeVerification>[]) {
  return setupServer(
    http.get("/api/v1/applications", () =>
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
    http.get("/api/v1/verifications", () =>
      HttpResponse.json({
        content: verifications,
        number: 0,
        size: 20,
        totalElements: verifications.length,
        totalPages: 1,
        first: true,
        last: true,
        empty: verifications.length === 0,
      }),
    ),
  );
}

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

describe("Dashboard navigation edge cases", () => {
  describe("special characters in app names", () => {
    const server = setupServerWithVerifications([
      makeVerification("1", "my app/special&chars", "consumer+name"),
    ]);

    beforeAll(() => {
      server.listen();
    });
    afterEach(() => {
      server.resetHandlers();
      mockNavigate.mockClear();
    });
    afterAll(() => {
      server.close();
    });

    it("should URL-encode special characters in provider name on row click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardPage />);

      const providerText = await screen.findByText("my app/special&chars");
      const row = providerText.closest("[class*='cursor-pointer']");
      if (row) await user.click(row);

      expect(mockNavigate).toHaveBeenCalledWith("/verifications?search=my%20app%2Fspecial%26chars");
    });

    it("should URL-encode special characters when clicking provider app link", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardPage />);

      // Click the provider name button (not the row)
      const providerButton = await screen.findByRole("button", {
        name: "my app/special&chars",
      });
      await user.click(providerButton);

      expect(mockNavigate).toHaveBeenCalledWith("/applications?search=my%20app%2Fspecial%26chars");
    });

    it("should URL-encode special characters when clicking consumer app link", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardPage />);

      const consumerButton = await screen.findByRole("button", {
        name: "consumer+name",
      });
      await user.click(consumerButton);

      expect(mockNavigate).toHaveBeenCalledWith("/applications?search=consumer%2Bname");
    });
  });

  describe("empty verifications", () => {
    const server = setupServerWithVerifications([]);

    beforeAll(() => {
      server.listen();
    });
    afterEach(() => {
      server.resetHandlers();
      mockNavigate.mockClear();
    });
    afterAll(() => {
      server.close();
    });

    it("should show empty message when no verifications", async () => {
      renderWithProviders(<DashboardPage />);
      expect(await screen.findByText("No verifications yet")).toBeInTheDocument();
    });
  });

  describe("clicking app link does not trigger row click", () => {
    const server = setupServerWithVerifications([
      makeVerification("1", "order-service", "payment-service"),
    ]);

    beforeAll(() => {
      server.listen();
    });
    afterEach(() => {
      server.resetHandlers();
      mockNavigate.mockClear();
    });
    afterAll(() => {
      server.close();
    });

    it("should only navigate to applications when clicking provider link (not both)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardPage />);

      const providerButton = await screen.findByRole("button", {
        name: "order-service",
      });
      await user.click(providerButton);

      // Should navigate to applications only (stopPropagation prevents row click)
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/applications?search=order-service");
    });
  });
});
