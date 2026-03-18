import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DataTable } from "../../../src/shared/components";

interface TestItem {
  id: string;
  name: string;
  value: number;
}

describe("DataTable", () => {
  const data: TestItem[] = [
    { id: "1", name: "Alpha", value: 3 },
    { id: "2", name: "Beta", value: 1 },
  ];

  const columns = [
    { key: "name", header: "Name" },
    { key: "value", header: "Value" },
  ];

  it("should render table headers", () => {
    render(<DataTable data={data} columns={columns} keyFn={(i) => i.id} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("should render data rows", () => {
    render(<DataTable data={data} columns={columns} keyFn={(i) => i.id} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("should show empty state when no data", () => {
    render(<DataTable data={[]} columns={columns} keyFn={(i: TestItem) => i.id} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("should sort when clicking header", async () => {
    render(<DataTable data={data} columns={columns} keyFn={(i) => i.id} />);
    await userEvent.click(screen.getByText("Name"));
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Alpha");
  });

  it("should not render pagination controls when no pagination prop", () => {
    // arrange & act
    render(<DataTable data={data} columns={columns} keyFn={(i) => i.id} />);

    // assert
    expect(screen.queryByText("Prev")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("should render pagination controls when pagination prop is provided", () => {
    // arrange & act
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 0,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
      />,
    );

    // assert — text is split across multiple React text nodes, use function matcher
    // With page=0, pageSize=10, totalElements=25: shows "Showing 1-10 of 25"
    expect(
      screen.getByText(
        (_content, el) =>
          el !== null && el.tagName === "SPAN" && el.textContent === "Showing 1-10 of 25",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, el) => el !== null && el.tagName === "SPAN" && el.textContent === "Page 1 of 3",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Prev")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("should call onPageChange when clicking Next", async () => {
    // arrange
    const onPageChange = vi.fn();
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 0,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange,
          onPageSizeChange: vi.fn(),
        }}
      />,
    );

    // act
    await userEvent.click(screen.getByText("Next"));

    // assert
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("should call onPageChange when clicking Prev", async () => {
    // arrange
    const onPageChange = vi.fn();
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 1,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange,
          onPageSizeChange: vi.fn(),
        }}
      />,
    );

    // act
    await userEvent.click(screen.getByText("Prev"));

    // assert
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("should disable Prev button on first page", () => {
    // arrange & act
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 0,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
      />,
    );

    // assert
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("should disable Next button on last page", () => {
    // arrange & act
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 2,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
      />,
    );

    // assert
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("should call onPageSizeChange when selecting a different page size", async () => {
    // arrange
    const onPageSizeChange = vi.fn();
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 0,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange: vi.fn(),
          onPageSizeChange,
        }}
      />,
    );

    // act
    const pageSizeSelect = screen.getByDisplayValue("10");
    await userEvent.selectOptions(pageSizeSelect, "20");

    // assert
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it("should disable client-side sort when pagination is active", async () => {
    // arrange — data with Beta before Alpha to check sort stays as-is
    render(
      <DataTable
        data={data}
        columns={columns}
        keyFn={(i) => i.id}
        pagination={{
          page: 0,
          pageSize: 10,
          totalElements: 25,
          totalPages: 3,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
      />,
    );

    // act — click header, should not sort
    await userEvent.click(screen.getByText("Name"));

    // assert — no sort indicator shown, data order unchanged
    expect(screen.queryByText(/Name.*\u25B2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Name.*\u25BC/)).not.toBeInTheDocument();
    const cells = screen.getAllByRole("cell");
    // First row: "Alpha", "3"; second row: "Beta", "1"
    expect(cells[0]).toHaveTextContent("Alpha");
    expect(cells[2]).toHaveTextContent("Beta");
  });

  it("should allow client-side sort when no pagination", async () => {
    // arrange
    render(<DataTable data={data} columns={columns} keyFn={(i) => i.id} />);

    // act — click Name header to sort ascending
    await userEvent.click(screen.getByText("Name"));

    // assert — sort indicator shown
    expect(screen.getByText(/Name/)).toHaveTextContent("Name \u25B2");
  });
});
