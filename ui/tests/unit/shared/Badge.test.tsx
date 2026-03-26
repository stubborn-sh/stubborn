import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../../../src/shared/components/ui";

describe("Badge", () => {
  it("should render with default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("should render with success variant", () => {
    render(<Badge variant="success">SUCCESS</Badge>);
    const badge = screen.getByText("SUCCESS");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-emerald-100");
  });

  it("should render with failed variant", () => {
    render(<Badge variant="failed">FAILED</Badge>);
    const badge = screen.getByText("FAILED");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-red-100");
  });

  it("should render with safe variant", () => {
    render(<Badge variant="safe">SAFE</Badge>);
    expect(screen.getByText("SAFE")).toBeInTheDocument();
  });

  it("should render with unsafe variant", () => {
    render(<Badge variant="unsafe">UNSAFE</Badge>);
    expect(screen.getByText("UNSAFE")).toBeInTheDocument();
  });

  it("should render with pending variant", () => {
    render(<Badge variant="pending">PENDING</Badge>);
    const badge = screen.getByText("PENDING");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-amber-100");
  });

  it("should render with destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    const badge = screen.getByText("Error");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-destructive");
  });

  it("should merge custom className", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("custom-class");
  });
});
