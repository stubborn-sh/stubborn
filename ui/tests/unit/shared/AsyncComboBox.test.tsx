import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AsyncComboBox from "@/shared/components/AsyncComboBox";

describe("AsyncComboBox", () => {
  let fetchOptions: ReturnType<typeof vi.fn<(query: string) => Promise<string[]>>>;

  beforeEach(() => {
    fetchOptions = vi
      .fn<(query: string) => Promise<string[]>>()
      .mockResolvedValue(["order-service", "payment-service", "user-service"]);
  });

  it("should render with placeholder", () => {
    render(
      <AsyncComboBox
        fetchOptions={fetchOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select application"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Select application");
  });

  it("should fetch options on focus", async () => {
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(fetchOptions).toHaveBeenCalledWith("");
    });
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("should debounce search input", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} debounceMs={300} />,
    );

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(fetchOptions).toHaveBeenCalledTimes(1);
    });

    fetchOptions.mockClear();
    await user.type(screen.getByRole("combobox"), "order");

    // Should not have called yet (debounced)
    expect(fetchOptions).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(fetchOptions).toHaveBeenCalledWith("order");
    });

    vi.useRealTimers();
  });

  it("should select option on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.click(screen.getByText("payment-service"));
    expect(onChange).toHaveBeenCalledWith("payment-service");
  });

  it("should navigate with keyboard arrows and select with Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("payment-service");
  });

  it("should close dropdown on Escape", async () => {
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("should show loading state", async () => {
    fetchOptions.mockReturnValue(
      new Promise((_resolve) => {
        /* intentionally never resolves */
      }),
    );
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("should show error state", async () => {
    fetchOptions.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByText("Failed to load options")).toBeInTheDocument();
    });
  });

  it("should be disabled when disabled prop is true", () => {
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("should display selected value", () => {
    render(
      <AsyncComboBox
        fetchOptions={fetchOptions}
        value="order-service"
        onChange={vi.fn()}
        placeholder="Select..."
      />,
    );
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "order-service");
  });

  it("should show 'No matches' when fetch returns empty", async () => {
    fetchOptions.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<AsyncComboBox fetchOptions={fetchOptions} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByText("No matches")).toBeInTheDocument();
    });
  });
});
