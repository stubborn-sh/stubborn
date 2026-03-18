import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui";
import { Separator } from "@/shared/components/ui";
import { Button, Label } from "@/shared/components/ui";
import { getUsername } from "@/shared/auth/auth-store";

function useThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return {
    dark,
    toggle: () => {
      setDark((d) => !d);
    },
  };
}

export default function SettingsPage() {
  const { dark, toggle } = useThemeToggle();
  const username = getUsername();

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Settings
        </h2>
        <p className="text-muted-foreground mt-1">Broker configuration and information</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Theme</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Switch between light and dark mode
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={toggle}>
                {dark ? "Light Mode" : "Dark Mode"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Logged in as</span>
              <span className="text-foreground font-medium">{username ?? "Unknown"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Base URL</span>
              <span className="text-foreground font-mono">{window.location.origin}/api/v1</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="text-foreground">0.1.0-SNAPSHOT</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Application</span>
              <span className="text-foreground">Spring Cloud Contract Broker</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Framework</span>
              <span className="text-foreground">Spring Boot 4.0.3</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
