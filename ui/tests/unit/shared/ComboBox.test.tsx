import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ComboBox } from "../../../src/shared/components";

const noop = vi.fn();

describe("ComboBox", () => {
  const options = ["Alpha", "Beta", "Gamma"];

  it("should render with placeholder", () => {
    // arrange & act
    render(<ComboBox options={options} value="" onChange={noop} placeholder="Pick one..." />);

    // assert
    expect(screen.getByPlaceholderText("Pick one...")).toBeInTheDocument();
  });

  it("should show options when focused", async () => {
    // arrange
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={noop} />);

    // act
    await user.click(screen.getByRole("combobox"));

    // assert
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("should filter options when typing", async () => {
    // arrange
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={noop} />);

    // act
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "al");

    // assert
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
  });

  it("should call onChange when selecting an option", async () => {
    // arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={onChange} />);

    // act
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Beta"));

    // assert
    expect(onChange).toHaveBeenCalledWith("Beta");
  });

  it("should show 'No matches' when filter has no results", async () => {
    // arrange
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={noop} />);

    // act
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "zzz");

    // assert
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    // arrange & act
    render(<ComboBox options={options} value="" onChange={noop} disabled />);

    // assert
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("should display the selected value", () => {
    // arrange & act
    render(<ComboBox options={options} value="Alpha" onChange={noop} placeholder="Pick..." />);

    // assert — when not focused, the input shows value in placeholder
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Alpha");
  });

  it("should navigate options with arrow keys", async () => {
    // arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={onChange} />);

    // act — open and arrow down twice, then Enter
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    // assert — should select "Beta" (index 1)
    expect(onChange).toHaveBeenCalledWith("Beta");
  });

  it("should wrap around when arrowing past last option", async () => {
    // arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={onChange} />);

    // act — open and arrow down 4 times (wraps from Gamma to Alpha)
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    await user.keyboard("{Enter}");

    // assert — wraps: Alpha(0)->Beta(1)->Gamma(2)->Alpha(0)
    expect(onChange).toHaveBeenCalledWith("Alpha");
  });

  it("should navigate up with ArrowUp", async () => {
    // arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={onChange} />);

    // act — open with ArrowDown, then ArrowUp wraps to last
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}");

    // assert — wraps to last: Gamma
    expect(onChange).toHaveBeenCalledWith("Gamma");
  });

  it("should set aria-expanded when open", async () => {
    // arrange
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={noop} />);

    // assert — closed initially
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");

    // act
    await user.click(input);

    // assert — open
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("should open dropdown with ArrowDown when closed", async () => {
    // arrange
    const user = userEvent.setup();
    render(<ComboBox options={options} value="" onChange={noop} />);

    // act — focus then ArrowDown
    const input = screen.getByRole("combobox");
    await user.click(input);
    // close it first
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    // re-open with ArrowDown
    await user.keyboard("{ArrowDown}");

    // assert
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});
