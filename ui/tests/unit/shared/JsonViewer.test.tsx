import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JsonViewer } from "../../../src/shared/components";

describe("JsonViewer", () => {
  it("should format valid JSON", () => {
    render(<JsonViewer content='{"key":"value"}' />);
    expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
  });

  it("should display non-JSON content as-is", () => {
    render(<JsonViewer content="request:\n  method: POST" />);
    expect(screen.getByText(/request:/)).toBeInTheDocument();
  });
});
