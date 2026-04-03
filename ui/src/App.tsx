import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/shared/components";
import { useAuth } from "@/shared/auth/useAuth";
import LoginPage from "@/shared/auth/LoginPage";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { ApplicationsPage } from "@/features/applications";
import { ContractsPage } from "@/features/contracts";
import { VerificationsPage } from "@/features/verifications";
import { EnvironmentsPage } from "@/features/environments";
import { CanIDeployPage } from "@/features/can-i-deploy";
import { SettingsPage } from "@/features/settings";
import { GraphPage } from "@/features/graph";
import { WebhooksPage } from "@/features/webhooks";
import { MatrixPage } from "@/features/matrix";
import { TagsPage } from "@/features/tags";
import { CleanupPage } from "@/features/cleanup";
import { SelectorsPage } from "@/features/selectors";
import { GitImportPage } from "@/features/git-import";
import { MavenImportPage } from "@/features/maven-import";
import { TopicsPage } from "@/features/topics";

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="verifications" element={<VerificationsPage />} />
        <Route path="environments" element={<EnvironmentsPage />} />
        <Route path="can-i-deploy" element={<CanIDeployPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="cleanup" element={<CleanupPage />} />
        <Route path="selectors" element={<SelectorsPage />} />
        <Route path="git-import" element={<GitImportPage />} />
        <Route path="maven-import" element={<MavenImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
