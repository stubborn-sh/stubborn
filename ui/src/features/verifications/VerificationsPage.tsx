import { useState, useDeferredValue } from "react";
import { useVerifications } from "./useVerifications";
import { DataTable, SearchInput, AppLink } from "@/shared/components";
import { Badge } from "@/shared/components/ui";
import type { VerificationResponse } from "@/api/types";
import { useSearchParams } from "react-router-dom";

export default function VerificationsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const {
    data: pageData,
    isLoading,
    error,
  } = useVerifications(deferredSearch || undefined, page, pageSize);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const columns = [
    {
      key: "providerName",
      header: "Provider",
      render: (v: VerificationResponse) => (
        <span className="font-medium text-foreground">
          <AppLink name={v.providerName} />{" "}
          <span className="text-muted-foreground text-xs">v{v.providerVersion}</span>
        </span>
      ),
    },
    {
      key: "consumerName",
      header: "Consumer",
      render: (v: VerificationResponse) => (
        <span className="text-foreground">
          <AppLink name={v.consumerName} />{" "}
          <span className="text-muted-foreground text-xs">v{v.consumerVersion}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (v: VerificationResponse) => (
        <Badge variant={v.status === "SUCCESS" ? "success" : "failed"}>{v.status}</Badge>
      ),
    },
    {
      key: "verifiedAt",
      header: "Verified At",
      render: (v: VerificationResponse) => (
        <span className="text-muted-foreground">{new Date(v.verifiedAt).toLocaleString()}</span>
      ),
    },
  ];

  if (error) return <p className="text-red-600">Failed to load verifications</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Verifications
        </h2>
        <p className="text-muted-foreground mt-1">Contract verification results</p>
      </div>
      <div className="max-w-md">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search verifications..."
        />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          data={pageData?.content ?? []}
          columns={columns}
          keyFn={(v) => v.id}
          pagination={
            pageData
              ? {
                  page,
                  pageSize,
                  totalElements: pageData.totalElements,
                  totalPages: pageData.totalPages,
                  onPageChange: setPage,
                  onPageSizeChange: (size) => {
                    setPageSize(size);
                    setPage(0);
                  },
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
