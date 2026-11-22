"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Building,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { messages } from "@/i18n/messages";
import { siteMessages } from "@/i18n/site";
import { viewMessages } from "@/i18n/views";
import { post } from "@/components/account/forms";
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Popover,
} from "@/components/ui/menu";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { LocaleSwitch, ThemeToggle } from "./preferences";
import { activeMenu, appModules, type ModuleDef } from "./modules";
import { BrandLogo } from "@/components/ui/brand";

export type ShellUser = { name: string; email: string; superadmin: boolean };
type Workspaces = {
  workspaces: { id: string; name: string; role?: string }[];
  active: null | { id: string; name?: string };
};

const SIDEBAR_KEY = "serentax-sidebar";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function useWorkspaces() {
  const [data, setData] = useState<Workspaces | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/workspaces", { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error("UNAVAILABLE");
          return (await r.json()) as Workspaces;
        })
        .then((value) => {
          if (active) {
            setData(value);
            setError(false);
          }
        })
        .catch(() => active && setError(true));
    void load();
    window.addEventListener("serentax:workspaces-changed", load);
    return () => {
      active = false;
      window.removeEventListener("serentax:workspaces-changed", load);
    };
  }, []);
  return { data, error };
}

function SidebarNav({
  modules,
  path,
  collapsed,
  onNavigate,
  navLabel,
}: {
  modules: ModuleDef[];
  path: string;
  collapsed: boolean;
  onNavigate?: () => void;
  navLabel: string;
}) {
  const current = activeMenu(modules, path);
  return (
    <nav aria-label={navLabel} className="space-y-5">
      {modules.map((module) => {
        const ModuleIcon = module.icon;
        return (
          <div key={module.id} className="space-y-1">
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-border" />
            ) : (
              <p className="flex items-center gap-2 px-3 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
                <ModuleIcon
                  aria-hidden="true"
                  className={`size-3.5 ${module.accent}`}
                />
                {module.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {module.items.map((item) => {
                const Icon = item.icon;
                const isCurrent = current?.item.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isCurrent ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-md text-sm transition-colors pointer-coarse:min-h-11",
                        collapsed
                          ? "mx-auto size-10 justify-center"
                          : "px-3 py-2",
                        isCurrent
                          ? "bg-foreground font-medium text-background"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className={cn("truncate", collapsed && "sr-only")}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  locale,
  user,
  children,
}: {
  locale: Locale;
  user: ShellUser;
  children: ReactNode;
}) {
  const t = siteMessages[locale];
  const v = viewMessages[locale];
  const path = usePathname();
  const modules = appModules(locale).filter(
    (m) => !m.superadminOnly || user.superadmin,
  );
  const current = activeMenu(modules, path);
  const isHome = path === `/${locale}/app`;
  const { data, error } = useWorkspaces();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {
      /* Expanded sidebar by default. */
    }
  }, []);
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
    } catch {
      /* Preference only. */
    }
  }

  async function selectWorkspace(id: string) {
    setBusy(true);
    try {
      await post("/api/workspaces", { action: "select", organizationId: id });
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await post("/api/auth/sign-out");
    } finally {
      window.location.assign(`/${locale}/auth/sign-in`);
    }
  }

  const activeWorkspace = data?.workspaces.find(
    (w) => w.id === data.active?.id,
  );
  const navbarButton =
    "inline-flex items-center justify-center rounded-md text-navbar-foreground/85 transition-colors hover:bg-navbar-hover hover:text-navbar-foreground";

  return (
    <ToastProvider closeLabel={v.close}>
      <a href="#app-content" className="skip-link">
        {messages[locale].skip}
      </a>
      <header className="sticky top-0 z-40 flex h-12 items-center gap-1 bg-navbar px-2 text-navbar-foreground sm:px-3">
        <button
          type="button"
          aria-label={v.openMenu}
          aria-expanded={drawer}
          onClick={() => setDrawer(true)}
          className={cn(navbarButton, "size-9 lg:hidden")}
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <Link
          href={`/${locale}/app`}
          aria-label={v.apps}
          title={v.apps}
          aria-current={isHome ? "page" : undefined}
          className={cn(
            navbarButton,
            "size-9 aria-[current=page]:bg-navbar-hover",
          )}
        >
          <LayoutGrid aria-hidden="true" className="size-5" />
        </Link>
        <Link
          href={`/${locale}/app`}
          className="hidden items-center px-2 text-white sm:flex"
        >
          <BrandLogo className="h-6" />
        </Link>
        {current && (
          <>
            <span
              aria-hidden="true"
              className="hidden h-5 w-px bg-navbar-foreground/20 sm:block"
            />
            <Link
              href={current.module.href}
              className="truncate px-2 text-sm font-semibold"
            >
              {current.module.label}
            </Link>
            <nav
              aria-label={current.module.label}
              className="hidden items-center gap-0.5 xl:flex"
            >
              {current.module.items.length > 1 &&
                current.module.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={
                      current.item.href === item.href ? "page" : undefined
                    }
                    className="rounded-md px-2.5 py-1.5 text-sm text-navbar-muted transition-colors hover:bg-navbar-hover hover:text-navbar-foreground aria-[current=page]:text-navbar-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Popover
            role="menu"
            align="end"
            width={280}
            label={t.workspaceLabel}
            trigger={({ toggle, ref, ...aria }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                {...aria}
                aria-label={`${t.workspaceLabel}: ${activeWorkspace?.name ?? v.noWorkspace}`}
                className={cn(
                  navbarButton,
                  "h-9 max-w-[14rem] gap-2 px-2.5 text-sm font-medium",
                )}
              >
                <Building aria-hidden="true" className="size-4 shrink-0" />
                <span className="hidden truncate md:block">
                  {activeWorkspace?.name ?? (data ? v.noWorkspace : v.loading)}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 shrink-0 opacity-70"
                />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>{v.switchWorkspace}</MenuLabel>
                {data?.workspaces.length ? (
                  data.workspaces.map((w) => (
                    <MenuItem
                      key={w.id}
                      checked={w.id === data.active?.id}
                      disabled={busy}
                      onSelect={() => {
                        close();
                        if (w.id !== data.active?.id)
                          void selectWorkspace(w.id);
                      }}
                    >
                      {w.name}
                    </MenuItem>
                  ))
                ) : (
                  <p className="px-2.5 py-2 text-sm text-muted-foreground">
                    {error ? t.appError : v.noWorkspace}
                  </p>
                )}
                <MenuSeparator />
                <MenuItem
                  icon={<Building />}
                  onSelect={() => {
                    close();
                    window.location.assign(`/${locale}/app/settings`);
                  }}
                >
                  {v.manageWorkspace}
                </MenuItem>
              </>
            )}
          </Popover>
          <LocaleSwitch
            locale={locale}
            compact
            className={cn(navbarButton, "h-9 px-2")}
          />
          <ThemeToggle locale={locale} className={navbarButton} />
          <Popover
            role="menu"
            align="end"
            width={260}
            label={v.userMenu}
            trigger={({ toggle, ref, ...aria }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                {...aria}
                aria-label={v.userMenu}
                className="ml-1 flex size-8 items-center justify-center rounded-full bg-navbar-foreground text-xs font-bold text-navbar hover:opacity-90"
              >
                {initials(user.name)}
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <MenuSeparator />
                <MenuItem
                  icon={<UserRound />}
                  onSelect={() => {
                    close();
                    window.location.assign(`/${locale}/app/settings`);
                  }}
                >
                  {v.profile}
                </MenuItem>
                <MenuItem
                  icon={<LogOut />}
                  disabled={busy}
                  onSelect={() => {
                    close();
                    void signOut();
                  }}
                >
                  {v.signOut}
                </MenuItem>
              </>
            )}
          </Popover>
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-3rem)]">
        <aside
          className={cn(
            "sticky top-12 hidden h-[calc(100dvh-3rem)] shrink-0 flex-col border-r bg-surface transition-[width] duration-200 lg:flex",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="scroll-thin flex-1 overflow-y-auto px-2 py-4">
            <SidebarNav
              modules={modules}
              path={path}
              collapsed={collapsed}
              navLabel={t.navigation}
            />
          </div>
          <div className="border-t p-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? v.expandSidebar : v.collapseSidebar}
              title={collapsed ? v.expandSidebar : v.collapseSidebar}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {collapsed ? (
                <ChevronsRight aria-hidden="true" className="size-4" />
              ) : (
                <>
                  <ChevronsLeft aria-hidden="true" className="size-4" />
                  <span>{v.collapseSidebar}</span>
                </>
              )}
            </button>
          </div>
        </aside>
        <main
          id="app-content"
          tabIndex={-1}
          className="min-w-0 flex-1 focus-visible:outline-none"
        >
          {children}
        </main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={v.close}
            tabIndex={-1}
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-[var(--overlay)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.navigation}
            className="animate-slide absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-surface shadow-lg"
          >
            <div className="flex h-12 items-center justify-between border-b px-4">
              <Link
                href={`/${locale}/app`}
                className="flex items-center text-foreground"
              >
                <BrandLogo className="h-6" />
              </Link>
              <button
                type="button"
                aria-label={v.close}
                onClick={() => setDrawer(false)}
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-2 py-4">
              <SidebarNav
                modules={modules}
                path={path}
                collapsed={false}
                onNavigate={() => setDrawer(false)}
                navLabel={t.navigation}
              />
            </div>
            <div className="flex items-center gap-2 border-t p-3">
              <LocaleSwitch locale={locale} className="hover:bg-muted" />
              <ThemeToggle locale={locale} className="hover:bg-muted" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm hover:bg-muted"
              >
                <LogOut aria-hidden="true" className="size-4" />
                {v.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastProvider>
  );
}
