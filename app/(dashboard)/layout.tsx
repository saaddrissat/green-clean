"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Cog,
  FileBarChart2,
  LayoutDashboard,
  ListChecks,
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
import { AppSidebar, type SidebarItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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

type ToastNotification = {
  id: string;
  title: string;
  message: string;
};

type StoredNotification = {
  id: string;
  title: string;
  message: string;
  level: "info" | "warning";
  period: "today" | "week" | "month";
  createdAt: string;
};

const unreadStorageKey = "gc-unread-notifications";
const notificationsStorageKey = "gc-notifications-feed";
const mockIncomingNotifications: Omit<ToastNotification, "id">[] = [
  {
    title: "Nouvelle commande urgente",
    message: "Une commande avec échéance proche vient d'être enregistrée.",
  },
  {
    title: "Alerte délai",
    message: "Une commande en cours approche la date de retrait.",
  },
  {
    title: "Notification caisse",
    message: "Un nouveau paiement a été validé sur la caisse.",
  },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isCaisse = pathname === "/caisse" || pathname.startsWith("/caisse/");
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const dismissToast = (toastId: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== toastId));
  };

  useEffect(() => {
    const stored = Number(localStorage.getItem(unreadStorageKey) ?? "0");
    setUnreadCount(Number.isFinite(stored) ? stored : 0);
  }, []);

  useEffect(() => {
    if (pathname !== "/notifications") return;
    setUnreadCount(0);
    localStorage.setItem(unreadStorageKey, "0");
  }, [pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const seed = Date.now();
      const next = mockIncomingNotifications[seed % mockIncomingNotifications.length];
      const incoming: ToastNotification = {
        id: `notif-${seed}`,
        title: next.title,
        message: next.message,
      };
      const storedIncoming: StoredNotification = {
        id: incoming.id,
        title: incoming.title,
        message: incoming.message,
        level: incoming.title.toLowerCase().includes("alerte") ? "warning" : "info",
        period: "today",
        createdAt: new Date().toISOString(),
      };

      setToasts((prev) => [...prev, incoming]);
      try {
        const current = JSON.parse(localStorage.getItem(notificationsStorageKey) ?? "[]") as StoredNotification[];
        const nextFeed = [storedIncoming, ...current].slice(0, 100);
        localStorage.setItem(notificationsStorageKey, JSON.stringify(nextFeed));
      } catch {
        // Ignore malformed local storage values.
      }
      window.setTimeout(() => {
        dismissToast(incoming.id);
      }, 4200);

      if (pathname !== "/notifications") {
        setUnreadCount((prev) => {
          const nextCount = prev + 1;
          localStorage.setItem(unreadStorageKey, String(nextCount));
          return nextCount;
        });
      }
    }, 45000);

    return () => window.clearInterval(interval);
  }, [pathname]);

  const navItems = baseNavItems.map((item) =>
    item.href === "/notifications" ? { ...item, hasAlert: unreadCount > 0 } : item,
  );
  const currentUserName = "Utilisateur actuel";
  const currentUserRole = "Admin";

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
          />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-col">
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
              <Sheet>
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
                <SheetContent className="w-[85vw] max-w-sm p-0">
                  <SheetHeader className="border-b border-slate-200 p-5">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <nav className="space-y-2 p-4">
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
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <main
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden",
              isCaisse ? "p-0" : "p-4 md:p-6",
            )}
          >
            {children}
          </main>
        </div>
      </div>
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((toast) => (
          <Link
            key={toast.id}
            href="/notifications"
            className="pointer-events-auto relative rounded-xl border border-slate-200 bg-white p-3 pr-10 shadow-lg shadow-slate-300/40"
            onClick={() => dismissToast(toast.id)}
          >
            <button
              type="button"
              aria-label="Fermer la notification"
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={(event) => {
                event.stopPropagation();
                dismissToast(toast.id);
              }}
            >
              ×
            </button>
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            <p className="mt-1 text-xs text-slate-600">{toast.message}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
