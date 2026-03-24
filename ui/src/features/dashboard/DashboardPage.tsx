import { useApplications } from "@/features/applications";
import { useVerifications } from "@/features/verifications";
import { useGraph } from "@/features/graph/useGraph";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui";
import { FileCode2, CheckCircle2, XCircle, Activity, GitBranch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const chartData = [
  { date: "Day 1", verified: 15, failed: 2 },
  { date: "Day 2", verified: 18, failed: 1 },
  { date: "Day 3", verified: 20, failed: 3 },
  { date: "Day 4", verified: 22, failed: 2 },
  { date: "Day 5", verified: 25, failed: 1 },
  { date: "Day 6", verified: 28, failed: 2 },
  { date: "Day 7", verified: 30, failed: 1 },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: appsPage, isLoading: appsLoading, error: appsError } = useApplications();
  const {
    data: verificationsPage,
    isLoading: verificationsLoading,
    error: verificationsError,
  } = useVerifications();
  const { data: graphData } = useGraph();

  if (appsError || verificationsError)
    return <p className="text-red-600">Failed to load dashboard data</p>;

  const apps = appsPage?.content;
  const verifications = verificationsPage?.content;
  const recentVerifications = verifications?.slice(0, 5) ?? [];
  const successCount = verifications?.filter((v) => v.status === "SUCCESS").length ?? 0;
  const failedCount = verifications?.filter((v) => v.status === "FAILED").length ?? 0;
  const totalCount = verifications?.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground mb-2">
          Dashboard
        </h2>
        <p className="text-muted-foreground">Overview of your contract testing ecosystem</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          className="cursor-pointer hover:border-emerald-500/50 transition-colors"
          onClick={() => void navigate("/applications")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Applications</CardTitle>
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {appsLoading ? "..." : (apps?.length ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registered applications</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-emerald-500/50 transition-colors"
          onClick={() => void navigate("/verifications")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Successful</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {verificationsLoading ? "..." : successCount}
            </div>
            <p className="text-xs text-emerald-600 mt-1">Verified contracts</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-red-500/50 transition-colors"
          onClick={() => void navigate("/verifications")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {verificationsLoading ? "..." : failedCount}
            </div>
            <p className="text-xs text-red-600 mt-1">Needs attention</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-emerald-500/50 transition-colors"
          onClick={() => void navigate("/verifications")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Verifications</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {verificationsLoading ? "..." : totalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Dependency Graph</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Recent dependency edges between services
              </p>
            </div>
            <GitBranch className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {graphData && graphData.edges.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Provider</th>
                      <th className="text-left py-2 text-muted-foreground font-medium"></th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Consumer</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphData.edges.slice(0, 5).map((edge, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 text-foreground">
                          {edge.providerName}{" "}
                          <span className="text-muted-foreground text-xs">
                            {edge.providerVersion}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{"<-"}</td>
                        <td className="py-2 text-foreground">
                          {edge.consumerName}{" "}
                          <span className="text-muted-foreground text-xs">
                            {edge.consumerVersion}
                          </span>
                        </td>
                        <td className="py-2">
                          <Badge variant={edge.status === "SUCCESS" ? "success" : "failed"}>
                            {edge.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                to="/graph"
                className="inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400"
              >
                View full graph
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No dependency data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Verification Trends</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Contract verification activity over the last 7 days
              </p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="verified"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.6}
                name="Verified"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="2"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
                name="Failed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Recent Verifications</CardTitle>
          <p className="text-sm text-muted-foreground">Latest contract verification results</p>
        </CardHeader>
        <CardContent>
          {recentVerifications.length === 0 && (
            <p className="text-muted-foreground text-sm">No verifications yet</p>
          )}
          <div className="space-y-3">
            {recentVerifications.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
                role="button"
                tabIndex={0}
                onClick={() =>
                  void navigate(`/verifications?search=${encodeURIComponent(v.providerName)}`)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    void navigate(`/verifications?search=${encodeURIComponent(v.providerName)}`);
                  }
                }}
              >
                <div>
                  <button
                    className="text-emerald-700 hover:underline dark:text-emerald-400 font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigate(`/applications?search=${encodeURIComponent(v.providerName)}`);
                    }}
                  >
                    {v.providerName}
                  </button>
                  <span className="text-muted-foreground mx-2">{"<-"}</span>
                  <button
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigate(`/applications?search=${encodeURIComponent(v.consumerName)}`);
                    }}
                  >
                    {v.consumerName}
                  </button>
                  <span className="text-muted-foreground text-xs ml-3">
                    {v.providerVersion} / {v.consumerVersion}
                  </span>
                </div>
                <Badge variant={v.status === "SUCCESS" ? "success" : "failed"}>{v.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
