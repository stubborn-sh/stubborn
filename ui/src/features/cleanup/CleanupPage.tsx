import { useState } from "react";
import { useCleanup } from "./useCleanup";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/shared/components/ui";

export default function CleanupPage() {
  const [applicationName, setApplicationName] = useState("");
  const [keepLatestVersions, setKeepLatestVersions] = useState(5);
  const [protectedEnvironments, setProtectedEnvironments] = useState("");

  const { mutate, data: result, isPending, error } = useCleanup();

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const envList = protectedEnvironments
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    mutate({
      applicationName: applicationName || undefined,
      keepLatestVersions,
      protectedEnvironments: envList.length > 0 ? envList : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Data Cleanup
        </h2>
        <p className="text-muted-foreground mt-1">
          Remove old contract versions to keep the broker tidy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Cleanup Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="cleanup-app-name">Application Name (optional)</Label>
                <Input
                  id="cleanup-app-name"
                  type="text"
                  value={applicationName}
                  onChange={(e) => {
                    setApplicationName(e.target.value);
                  }}
                  placeholder="All applications"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanup-keep-versions">Keep Latest Versions</Label>
                <Input
                  id="cleanup-keep-versions"
                  type="number"
                  min={1}
                  value={keepLatestVersions}
                  onChange={(e) => {
                    setKeepLatestVersions(Number(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanup-protected-envs">Protected Environments</Label>
                <Input
                  id="cleanup-protected-envs"
                  type="text"
                  value={protectedEnvironments}
                  onChange={(e) => {
                    setProtectedEnvironments(e.target.value);
                  }}
                  placeholder="production, staging"
                />
              </div>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Running..." : "Run Cleanup"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-red-600">Cleanup failed</p>}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <CardTitle className="text-foreground">Result</CardTitle>
              <Badge variant={result.deletedCount > 0 ? "pending" : "success"}>
                {result.deletedCount} deleted
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {result.deletedContracts.length > 0 ? (
              <ul className="space-y-1 text-sm text-foreground">
                {result.deletedContracts.map((c) => (
                  <li key={c} className="font-mono">
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No contracts were deleted.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
