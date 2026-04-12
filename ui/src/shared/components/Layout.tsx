import { useState, useEffect, useMemo, useCallback } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FileCode2,
  CheckCircle2,
  Globe,
  ShieldCheck,
  GitBranch,
  Bell,
  Table,
  Tag,
  Trash2,
  Filter,
  Settings,
  LogOut,
  Sun,
  Moon,
  Bot,
  Server,
  FolderGit2,
  Package,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/shared/auth/useAuth";
import { useBrokerInfo } from "@/shared/useBrokerInfo";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  proOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: Building2 },
  { to: "/contracts", label: "Contracts", icon: FileCode2 },
  { to: "/verifications", label: "Verifications", icon: CheckCircle2 },
  { to: "/environments", label: "Environments", icon: Globe },
  { to: "/can-i-deploy", label: "Can I Deploy", icon: ShieldCheck },
  { to: "/graph", label: "Dependencies", icon: GitBranch },
  { to: "/topics", label: "Topics", icon: MessageSquare },
  { to: "/webhooks", label: "Webhooks", icon: Bell },
  { to: "/matrix", label: "Matrix", icon: Table },
  { to: "/tags", label: "Tags", icon: Tag },
  { to: "/cleanup", label: "Cleanup", icon: Trash2 },
  { to: "/selectors", label: "Selectors", icon: Filter },
  { to: "/git-import", label: "Git Import", icon: FolderGit2 },
  { to: "/maven-import", label: "Maven Import", icon: Package },
  { to: "/ai-proxy", label: "AI Proxy", icon: Bot, proOnly: true },
  { to: "/mcp-server", label: "MCP Server", icon: Server, proOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

function useTheme() {
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

export default function Layout() {
  const { username, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { data: brokerInfo } = useBrokerInfo();
  const proEnabled = brokerInfo?.proEnabled ?? false;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.proOnly || proEnabled),
    [proEnabled],
  );

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="bg-emerald-500 p-2 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">S</span>
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Stubborn</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Contract Governance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="text-sm text-muted-foreground hidden sm:inline">{username}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <aside
          className={cn(
            "bg-sidebar border-r border-sidebar-border min-h-[calc(100vh-73px)] z-40",
            // Desktop: always visible, sticky
            "hidden md:block md:w-64 md:sticky md:top-[73px]",
            // Mobile: fixed overlay when open
            sidebarOpen && "!block fixed top-[73px] left-0 w-64 bottom-0 overflow-y-auto",
          )}
        >
          <nav className="p-4 space-y-1">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm",
                    isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "text-foreground hover:bg-sidebar-accent",
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground">
            v0.1.0-SNAPSHOT
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
