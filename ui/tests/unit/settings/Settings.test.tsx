import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SettingsPage } from "../../../src/features/settings";

describe("Settings", () => {
  it("should render settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should show version", () => {
    render(<SettingsPage />);
    expect(screen.getByText("0.1.0-SNAPSHOT")).toBeInTheDocument();
  });
});
