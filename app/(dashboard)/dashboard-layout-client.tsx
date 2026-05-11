"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Cog,
  FileBarChart2,
  Search,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction } from "@/app/actions/auth";
import { globalSearchAction, type GlobalSearchResult } from "@/app/actions/global-search";
import { getUnreadNotificationCountAction } from "@/app/actions/notifications";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { AppSidebar, type SidebarItem } from "@/components/ui/sidebar";
import { findAccountById } from "@/lib/gc-settings-storage";
import { demoBlocksRapports } from "@/lib/plan-features";
import {
  effectivePageAccess,
  firstAllowedHref,
  hrefToPageKey,
  isPathAllowed,
  type PageAccess,
} from "@/lib/navigation-page-access";
import { getNavigationContext, resetNavigationToFullAccess } from "@/lib/navigation-context";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@prisma/client";

const baseNavItems: SidebarItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Caisse", href: "/caisse", icon: ShoppingCart },
  { label: "Suivi", href: "/suivi", icon: ListChecks },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
  { label: "Portefeuille", href: "/portefeuille", icon: Wallet },
  { label: "Rapports", href: "/rapports", icon: FileBarChart2 },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Parametres", href: "/parametres", icon: Cog },
];

function filterNavByAccess(
  items: SidebarItem[],
  access: Record<string, boolean>,
): SidebarItem[] {
  return items.filter((item) => {
    const key = hrefToPageKey(item.href);
    if (!key) return true;
    return access[key] === true;
  });
}

export type DashboardInitialSessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CAISSIER";
  staffAccountId: string | null;
  pageAccess: PageAccess | null;
  plan: SubscriptionPlan;
};

export default function DashboardLayoutClient({
  children,
  initialSessionUser,
}: Readonly<{
  children: React.ReactNode;
  initialSessionUser: DashboardInitialSessionUser;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [navEpoch, setNavEpoch] = useState(0);
  const isCaisse = pathname === "/caisse" || pathname.startsWith("/caisse/");
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<DashboardInitialSessionUser>(initialSessionUser);
  const [logoutPending, startLogoutTransition] = useTransition();

  useEffect(() => {
    const sync = () => {
      void getUnreadNotificationCountAction()
        .then(setUnreadCount)
        .catch(() => {});
    };
    sync();
    const id = window.setInterval(sync, 45000);
    const onFocus = () => sync();
    const onBus = () => sync();
    window.addEventListener("focus", onFocus);
    window.addEventListener("gc-notifications-updated", onBus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("gc-notifications-updated", onBus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSessionUser = () => {
      void fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: {
          id?: string;
          name?: string;
          email?: string;
          role?: "ADMIN" | "CAISSIER";
          staffAccountId?: string | null;
          pageAccess?: PageAccess | null;
          plan?: SubscriptionPlan;
        } | null) => {
          if (!cancelled && data?.id && data?.email) {
            const trimmed = typeof data.name === "string" ? data.name.trim() : "";
            const name =
              trimmed.length > 0 ? trimmed : (data.email.split("@")[0] ?? initialSessionUser.name);
            setSessionUser({
              id: data.id,
              name,
              email: data.email,
              role: data.role ?? initialSessionUser.role,
              staffAccountId: data.staffAccountId ?? null,
              pageAccess: data.pageAccess ?? initialSessionUser.pageAccess,
              plan: data.plan ?? initialSessionUser.plan,
            });
          }
        })
        .catch(() => {});
    };
    loadSessionUser();
    window.addEventListener("focus", loadSessionUser);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadSessionUser);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setNavEpoch((n) => n + 1);
    window.addEventListener("gc-navigation-context-changed", refresh);
    window.addEventListener("gc-settings-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("gc-navigation-context-changed", refresh);
      window.removeEventListener("gc-settings-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const resolvedAccess = useMemo(() => {
    if (sessionUser?.role === "CAISSIER" && sessionUser.pageAccess) {
      return sessionUser.pageAccess;
    }
    const ctx = getNavigationContext();
    if (ctx.mode === "full") return null;
    const account = findAccountById(ctx.accountId, sessionUser?.id);
    if (!account) return null;
    return effectivePageAccess(account);
  }, [navEpoch, sessionUser?.id, sessionUser?.role, sessionUser?.pageAccess]); // eslint-disable-line react-hooks/exhaustive-deps -- navEpoch : recalcul contexte / comptes

  const activeCaissierAccount = useMemo(() => {
    const ctx = getNavigationContext();
    if (ctx.mode !== "restricted") return null;
    return findAccountById(ctx.accountId, sessionUser?.id) ?? null;
  }, [navEpoch, sessionUser?.id]);

  useEffect(() => {
    if (!resolvedAccess) return;
    if (isPathAllowed(pathname, resolvedAccess)) return;
    router.replace(firstAllowedHref(resolvedAccess));
  }, [pathname, resolvedAccess, router]);

  useEffect(() => {
    if (pathname !== "/notifications") return;
    void getUnreadNotificationCountAction()
      .then(setUnreadCount)
      .catch(() => {});
  }, [pathname]);

  const visibleNav = useMemo(() => {
    let items = resolvedAccess ? filterNavByAccess(baseNavItems, resolvedAccess) : baseNavItems;
    const plan = sessionUser.plan;
    if (demoBlocksRapports(plan)) {
      items = items.filter((item) => item.href !== "/rapports");
    }
    return items;
  }, [resolvedAccess, sessionUser.plan]);

  const navItems = useMemo(
    () =>
      visibleNav.map((item) =>
        item.href === "/notifications" ? { ...item, hasAlert: unreadCount > 0 } : item,
      ),
    [visibleNav, unreadCount],
  );
  const canAccessNotifications = !resolvedAccess || resolvedAccess.notifications === true;
  const pageResults = useMemo<GlobalSearchResult[]>(
    () =>
      navItems.map((item) => ({
        id: `page-${item.href}`,
        label: item.label,
        subtitle: "Page",
        href: item.href,
        kind: "page",
      })),
    [navItems],
  );
  const currentUserName =
    activeCaissierAccount?.fullName?.trim() ||
    sessionUser?.name?.trim() ||
    initialSessionUser.name ||
    "Utilisateur";
  const sessionRole = sessionUser?.role ?? initialSessionUser.role;
  const currentUserRole = activeCaissierAccount
    ? "Caissier"
    : sessionRole === "CAISSIER"
      ? "Caissier"
      : "Admin";

  const handleLogout = () => {
    resetNavigationToFullAccess();
    setNavEpoch((n) => n + 1);
    setMobileMenuOpen(false);
    startLogoutTransition(() => {
      void logoutAction();
    });
  };

  useEffect(() => {
    const q = searchValue.trim();
    if (q.length < 2) {
      setSearchResults((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const t = window.setTimeout(() => {
      const qLower = q.toLowerCase();
      const pageMatches = pageResults.filter((p) => p.label.toLowerCase().includes(qLower)).slice(0, 6);
      void globalSearchAction(q)
        .then((remote) => setSearchResults([...pageMatches, ...remote]))
        .catch(() => setSearchResults(pageMatches));
    }, 220);
    return () => window.clearTimeout(t);
  }, [searchValue, pageResults]);

  const openSearchResult = (href: string) => {
    setSearchOpen(false);
    setSearchValue("");
    router.push(href);
  };

  return (
    <div className="h-dvh bg-slate-100 text-slate-900">
      <div className="grid h-full md:grid-cols-[4.5rem_1fr]">
        <div className="hidden border-r border-slate-200 md:block">
          <AppSidebar
            title="Blanchisserie Green Clean"
            items={navItems}
            variant="icon-only"
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            onLogout={handleLogout}
            logoutDisabled={logoutPending}
          />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-col">
          {!isCaisse ? (
            <div className="hidden items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:flex">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Rechercher pages, clients, fournisseurs..."
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm outline-none ring-0 transition focus:border-emerald-500 focus:bg-white"
                />
                {searchOpen && searchValue.trim().length >= 2 ? (
                  <div className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">Aucun résultat.</p>
                    ) : (
                      searchResults.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openSearchResult(row.href)}
                          className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{row.label}</span>
                            <span className="block text-xs text-slate-500">{row.subtitle}</span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                            {row.kind}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {canAccessNotifications ? <NotificationCenter /> : null}
            </div>
          ) : null}
          <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white">
                  GC
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Green Clean</p>
                  <p className="text-xs text-slate-500">Laundry POS</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isCaisse && canAccessNotifications ? <NotificationCenter /> : null}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 rounded-full border border-slate-200 shadow-sm"
                    aria-label="Ouvrir le menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="flex w-[85vw] max-w-sm flex-col p-0">
                  <SheetHeader className="border-b border-slate-200 p-5">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SheetClose asChild key={item.href}>
                          <Link
                            href={item.href}
                            className="relative flex min-h-12 items-center gap-3 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800"
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            {item.href === "/notifications" && unreadCount > 0 ? (
                              <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500" />
                            ) : null}
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </nav>
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={handleLogout}
                      disabled={logoutPending}
                    >
                      <LogOut className="h-4 w-4" />
                      {logoutPending ? "Déconnexion…" : "Déconnexion"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              </div>
            </div>
            {!isCaisse ? (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="Rechercher partout..."
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
                {searchOpen && searchValue.trim().length >= 2 ? (
                  <div className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">Aucun résultat.</p>
                    ) : (
                      searchResults.map((row) => (
                        <button
                          key={`${row.id}-mobile`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openSearchResult(row.href)}
                          className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{row.label}</span>
                            <span className="block text-xs text-slate-500">{row.subtitle}</span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                            {row.kind}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <main
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-x-hidden",
              isCaisse
                ? "flex flex-col overflow-hidden p-0"
                : "overflow-y-auto p-4 md:p-6",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
