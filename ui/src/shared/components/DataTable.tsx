import { Fragment, useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface PaginationProps {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyFn: (item: T) => string;
  pagination?: PaginationProps;
  expandedKey?: string | null;
  renderExpandedRow?: (item: T) => React.ReactNode;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function DataTable<T>({
  data,
  columns,
  keyFn,
  pagination,
  expandedKey,
  renderExpandedRow,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Disable client-side sort when server-side pagination is active — sorting
  // only the visible page (e.g. 20 rows) would be misleading.
  const serverPaginated = !!pagination;

  const sorted =
    sortKey && !serverPaginated
      ? [...data].sort((a, b) => {
          /* eslint-disable security/detect-object-injection, @typescript-eslint/no-base-to-string */
          const aVal = String((a as Record<string, unknown>)[sortKey] ?? "");
          const bVal = String((b as Record<string, unknown>)[sortKey] ?? "");
          /* eslint-enable security/detect-object-injection, @typescript-eslint/no-base-to-string */
          return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        })
      : data;

  const getCellValue = (item: T, key: string): string => {
    // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-base-to-string
    return String((item as Record<string, unknown>)[key] ?? "");
  };

  const handleSort = (key: string) => {
    if (serverPaginated) return;
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const showFrom = pagination ? pagination.page * pagination.pageSize + 1 : 0;
  const showTo = pagination
    ? Math.min((pagination.page + 1) * pagination.pageSize, pagination.totalElements)
    : 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table data-testid="data-table" className="w-full text-sm text-left">
        <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wider">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 select-none ${serverPaginated ? "" : "cursor-pointer hover:text-foreground"}`}
                onClick={() => {
                  handleSort(col.key);
                }}
              >
                {col.header}
                {!serverPaginated && sortKey === col.key && (sortAsc ? " \u25B2" : " \u25BC")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((item) => {
            const key = keyFn(item);
            const isExpanded =
              expandedKey != null && key === expandedKey && renderExpandedRow != null;
            return (
              <Fragment key={key}>
                <tr className="hover:bg-accent">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-foreground">
                      {col.render ? col.render(item) : getCellValue(item, col.key)}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-3">
                      {renderExpandedRow(item)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pagination && pagination.totalElements > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {showFrom}-{showTo} of {pagination.totalElements}
          </span>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                pagination.onPageSizeChange(Number(e.target.value));
              }}
              className="h-8 rounded-md border bg-input-background px-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page === 0}
              onClick={() => {
                pagination.onPageChange(pagination.page - 1);
              }}
              className="rounded-md border px-3 py-1 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span>
              Page {pagination.page + 1} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages - 1}
              onClick={() => {
                pagination.onPageChange(pagination.page + 1);
              }}
              className="rounded-md border px-3 py-1 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
