"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Filter } from "lucide-react";
import type { NotificationCategory } from "@prisma/client";

import {
  getUnreadNotificationCountAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationRow,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<NotificationCategory | "ALL", string> = {
  ALL: "Toutes",
  SECURITY_AUDIT: "Sécurité",
  OPERATIONS: "Opérations",
  CALENDAR: "Calendrier",
  SMART_ALERT: "Smart",
  BILLING: "Facturation",
};

function badgeClassForPriority(priority: NotificationRow["priority"]) {
  if (priority === "CRITICAL") return "bg-rose-600 text-white";
  if (priority === "REMINDER") return "bg-amber-500 text-white";
  return "bg-sky-600 text-white";
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<NotificationCategory | "ALL">("ALL");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const syncUnread = useCallback(() => {
    void getUnreadNotificationCountAction()
      .then(setUnread)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listNotificationsAction({
        category: category === "ALL" ? undefined : category,
        limit: 60,
      });
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    syncUnread();
    const id = window.setInterval(syncUnread, 45000);
    const onFocus = () => syncUnread();
    const onUpdated = () => syncUnread();
    window.addEventListener("focus", onFocus);
    window.addEventListener("gc-notifications-updated", onUpdated);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("gc-notifications-updated", onUpdated);
    };
  }, [syncUnread]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const filteredLabel = useMemo(() => CATEGORY_LABELS[category], [category]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load();
  };

  const handleReadOne = async (n: NotificationRow) => {
    if (!n.isRead) {
      await markNotificationReadAction(n.id);
      window.dispatchEvent(new CustomEvent("gc-notifications-updated"));
      router.refresh();
    }
    setItems((prev) => prev.map((row) => (row.id === n.id ? { ...row, isRead: true } : row)));
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsReadAction();
    window.dispatchEvent(new CustomEvent("gc-notifications-updated"));
    router.refresh();
    setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,380px)] p-0" align="end">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <p className="text-sm font-semibold text-slate-900">Centre de notifications</p>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={handleMarkAll}>
            <CheckCheck className="h-4 w-4" />
            Tout lu
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-2">
          <Filter className="mx-1 h-3.5 w-3.5 text-slate-400" aria-hidden />
          {(Object.keys(CATEGORY_LABELS) as Array<NotificationCategory | "ALL">).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                category === key ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="max-h-[min(70vh,420px)] overflow-y-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Aucune alerte ({filteredLabel}).</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleReadOne(n)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition hover:bg-slate-50",
                      !n.isRead && "bg-sky-50/80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          badgeClassForPriority(n.priority),
                        )}
                      >
                        {n.priority === "CRITICAL" ? "Critique" : n.priority === "REMINDER" ? "Rappel" : "Info"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{n.message}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 px-3 py-2">
          <Link
            href="/notifications"
            className="block text-center text-xs font-semibold text-sky-700 hover:underline"
            onClick={() => setOpen(false)}
          >
            Voir tout le centre notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
