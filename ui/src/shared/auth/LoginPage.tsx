import { useState } from "react";
import { LogIn, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "./useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-emerald-500 p-3 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl leading-none">S</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">Stubborn</h1>
            <p className="text-sm text-muted-foreground">Contract Governance Platform</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Default credentials: <span className="font-medium">admin:admin</span> /{" "}
          <span className="font-medium">publisher:publisher</span> /{" "}
          <span className="font-medium">reader:reader</span>
        </p>
      </div>
    </div>
  );
}
