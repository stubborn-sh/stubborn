import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SearchInput } from "../../../src/shared/components";

describe("SearchInput", () => {
  it("should render with placeholder", () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Search apps..." />);
    expect(screen.getByPlaceholderText("Search apps...")).toBeInTheDocument();
  });

  it("should call onChange when typing", async () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "test");
    expect(onChange).toHaveBeenCalled();
  });

  it("should display current value", () => {
    render(<SearchInput value="hello" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("hello");
  });
});
