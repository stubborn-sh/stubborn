import { useState, useMemo } from "react";
import { useMatrix } from "./useMatrix";
import { useSearchApplications } from "@/features/applications";
import { DataTable, SearchInput, AsyncComboBox, AppLink } from "@/shared/components";
import { Badge, Label } from "@/shared/components/ui";
import type { MatrixEntry } from "@/api/types";

const columns = [
  {
    key: "providerName",
    header: "Provider",
    render: (m: MatrixEntry) => (
      <span className="font-medium text-foreground">
        <AppLink name={m.providerName} />{" "}
        <span className="text-muted-foreground text-xs">v{m.providerVersion}</span>
      </span>
    ),
  },
  {
    key: "consumerName",
    header: "Consumer",
    render: (m: MatrixEntry) => (
      <span className="text-foreground">
        <AppLink name={m.consumerName} />{" "}
        <span className="text-muted-foreground text-xs">v{m.consumerVersion}</span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (m: MatrixEntry) => (
      <Badge variant={m.status === "SUCCESS" ? "success" : "failed"}>{m.status}</Badge>
    ),
  },
  {
    key: "branch",
    header: "Branch",
    render: (m: MatrixEntry) => <span className="text-muted-foreground">{m.branch ?? "-"}</span>,
  },
  {
    key: "verifiedAt",
    header: "Verified At",
    render: (m: MatrixEntry) => (
      <span className="text-muted-foreground">{new Date(m.verifiedAt).toLocaleString()}</span>
    ),
  },
];

export default function MatrixPage() {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [consumerFilter, setConsumerFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const searchApps = useSearchApplications();
  const {
    data: entries,
    isLoading,
    error,
  } = useMatrix(providerFilter || undefined, consumerFilter || undefined);

  const sorted = useMemo(() => {
    const filtered =
      entries?.filter(
        (m) =>
          m.providerName.toLowerCase().includes(search.toLowerCase()) ||
          m.consumerName.toLowerCase().includes(search.toLowerCase()),
      ) ?? [];
    return [...filtered].sort(
      (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime(),
    );
  }, [entries, search]);

  const totalElements = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  if (error) return <p className="text-red-600">Failed to load compatibility matrix</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Compatibility Matrix
        </h2>
        <p className="text-muted-foreground mt-1">Cross-provider/consumer verification status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <AsyncComboBox
            fetchOptions={searchApps}
            value={providerFilter}
            onChange={(val) => {
              setProviderFilter(val);
              setPage(0);
            }}
            placeholder="All providers"
          />
        </div>
        <div className="space-y-2">
          <Label>Consumer</Label>
          <AsyncComboBox
            fetchOptions={searchApps}
            value={consumerFilter}
            onChange={(val) => {
              setConsumerFilter(val);
              setPage(0);
            }}
            placeholder="All consumers"
          />
        </div>
      </div>

      <SearchInput value={search} onChange={handleSearchChange} placeholder="Filter results..." />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          data={paged}
          columns={columns}
          keyFn={(m) =>
            `${m.providerName}-${m.providerVersion}-${m.consumerName}-${m.consumerVersion}`
          }
          pagination={{
            page,
            pageSize,
            totalElements,
            totalPages,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(0);
            },
          }}
        />
      )}
    </div>
  );
}
