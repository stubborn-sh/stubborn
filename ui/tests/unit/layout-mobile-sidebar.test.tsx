import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/shared/components";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderLayout(initialRoute: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="dashboard" element={<div>Dashboard Content</div>} />
            <Route path="applications" element={<div>Applications Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Layout mobile sidebar toggle", () => {
  it("should render hamburger menu button with aria-label 'Open menu'", () => {
    // given & when
    renderLayout("/dashboard");

    // then
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("should hide sidebar by default on mobile (has class 'hidden')", () => {
    // given & when
    renderLayout("/dashboard");

    // then
    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("hidden");
  });

  it("should show sidebar after clicking hamburger button", async () => {
    // given
    const user = userEvent.setup();
    renderLayout("/dashboard");
    const hamburger = screen.getByRole("button", { name: "Open menu" });

    // when
    await user.click(hamburger);

    // then
    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("!block");
  });

  it("should close sidebar when clicking overlay", async () => {
    // given
    const user = userEvent.setup();
    renderLayout("/dashboard");
    const hamburger = screen.getByRole("button", { name: "Open menu" });
    await user.click(hamburger);
    const overlay = document.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();

    // when
    await user.click(overlay!);

    // then
    const aside = screen.getByRole("complementary");
    expect(aside.className).not.toContain("!block");
  });

  it("should close sidebar on navigation (pathname change)", async () => {
    // given
    const user = userEvent.setup();
    renderLayout("/dashboard");
    const hamburger = screen.getByRole("button", { name: "Open menu" });
    await user.click(hamburger);
    expect(screen.getByRole("complementary").className).toContain("!block");

    // when — click a nav link to change the pathname
    const applicationsLink = screen.getByRole("link", { name: "Applications" });
    await user.click(applicationsLink);

    // then — pathname changed to /applications, sidebarPath still points to /dashboard
    const aside = screen.getByRole("complementary");
    expect(aside.className).not.toContain("!block");
  });

  it("should keep sidebar always visible on desktop via md:block class", () => {
    // given & when
    renderLayout("/dashboard");

    // then — aside always has md:block regardless of mobile toggle state
    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("md:block");
  });
});
