import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/shared/components";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderLayoutWithRoute(initialRoute: string, _children?: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="dashboard" element={<div>Dashboard Content</div>} />
            <Route path="applications" element={<div>Applications Content</div>} />
            <Route path="contracts" element={<div>Contracts Content</div>} />
            <Route path="verifications" element={<div>Verifications Content</div>} />
            <Route path="environments" element={<div>Environments Content</div>} />
            <Route path="can-i-deploy" element={<div>Can I Deploy Content</div>} />
            <Route path="graph" element={<div>Dependencies Content</div>} />
            <Route path="settings" element={<div>Settings Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Layout", () => {
  it("should render the application title", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    expect(screen.getByText("Stubborn")).toBeInTheDocument();
  });

  it("should render the subtitle", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    expect(screen.getByText("Contract Governance")).toBeInTheDocument();
  });

  it("should render all navigation links", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Applications")).toBeInTheDocument();
    expect(screen.getByText("Contracts")).toBeInTheDocument();
    expect(screen.getByText("Verifications")).toBeInTheDocument();
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("Can I Deploy")).toBeInTheDocument();
    expect(screen.getByText("Dependencies")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Matrix")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Selectors")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should render navigation links as anchor elements", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(15);
  });

  it("should render correct href for each nav link", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Applications" })).toHaveAttribute(
      "href",
      "/applications",
    );
    expect(screen.getByRole("link", { name: "Contracts" })).toHaveAttribute("href", "/contracts");
    expect(screen.getByRole("link", { name: "Verifications" })).toHaveAttribute(
      "href",
      "/verifications",
    );
    expect(screen.getByRole("link", { name: "Environments" })).toHaveAttribute(
      "href",
      "/environments",
    );
    expect(screen.getByRole("link", { name: "Can I Deploy" })).toHaveAttribute(
      "href",
      "/can-i-deploy",
    );
    expect(screen.getByRole("link", { name: "Dependencies" })).toHaveAttribute("href", "/graph");
    expect(screen.getByRole("link", { name: "Webhooks" })).toHaveAttribute("href", "/webhooks");
    expect(screen.getByRole("link", { name: "Matrix" })).toHaveAttribute("href", "/matrix");
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute("href", "/tags");
    expect(screen.getByRole("link", { name: "Cleanup" })).toHaveAttribute("href", "/cleanup");
    expect(screen.getByRole("link", { name: "Selectors" })).toHaveAttribute("href", "/selectors");
    expect(screen.getByRole("link", { name: "Git Import" })).toHaveAttribute("href", "/git-import");
    expect(screen.getByRole("link", { name: "Maven Import" })).toHaveAttribute(
      "href",
      "/maven-import",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("should render children content in the main area", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("should render different children based on route", () => {
    // arrange & act
    renderLayoutWithRoute("/applications");

    // assert
    expect(screen.getByText("Applications Content")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("should highlight the active navigation item for dashboard", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert - active link has emerald styling
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("text-emerald-700");
  });

  it("should highlight the active navigation item for applications", () => {
    // arrange & act
    renderLayoutWithRoute("/applications");

    // assert
    const applicationsLink = screen.getByRole("link", { name: "Applications" });
    expect(applicationsLink.className).toContain("text-emerald-700");

    // non-active link should not have active styling
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).not.toContain("bg-emerald-50");
  });

  it("should highlight the active navigation item for can-i-deploy", () => {
    // arrange & act
    renderLayoutWithRoute("/can-i-deploy");

    // assert
    const canIDeployLink = screen.getByRole("link", { name: "Can I Deploy" });
    expect(canIDeployLink.className).toContain("text-emerald-700");
  });

  it("should render the version in the sidebar footer", () => {
    // arrange & act
    renderLayoutWithRoute("/dashboard");

    // assert
    expect(screen.getByText("v0.1.0-SNAPSHOT")).toBeInTheDocument();
  });
});
