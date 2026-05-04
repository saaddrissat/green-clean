"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, TrendingUp } from "lucide-react";
import type { NotificationCategory } from "@prisma/client";

import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationRow,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: Array<{ id: NotificationCategory | "ALL"; label: string }> = [
  { id: "ALL", label: "Toutes" },
  { id: "SECURITY_AUDIT", label: "Sécurité & audit" },
  { id: "OPERATIONS", label: "Opérations" },
  { id: "CALENDAR", label: "Calendrier" },
  { id: "SMART_ALERT", label: "Smart alerts" },
  { id: "BILLING", label: "Facturation" },
];

function badgeForPriority(priority: NotificationRow["priority"]) {
  if (priority === "CRITICAL") return { label: "Critique", className: "bg-rose-600 text-white" };
  if (priority === "REMINDER") return { label: "Rappel", className: "bg-amber-500 text-white" };
  return { label: "Info", className: "bg-sky-600 text-white" };
}

export default function NotificationsPage() {
  const [category, setCategory] = useState<NotificationCategory | "ALL">("ALL");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotificationsAction({
        category: category === "ALL" ? undefined : category,
        limit: 100,
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const critical = rows.filter((r) => r.priority === "CRITICAL").length;
    const reminders = rows.filter((r) => r.priority === "REMINDER").length;
    const info = rows.filter((r) => r.priority === "INFO").length;
    return { total, critical, reminders, info };
  }, [rows]);

  const handleMarkRead = async (id: string) => {
    await markNotificationReadAction(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: true } : r)));
    window.dispatchEvent(new CustomEvent("gc-notifications-updated"));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsReadAction();
    setRows((prev) => prev.map((r) => ({ ...r, isRead: true })));
    window.dispatchEvent(new CustomEvent("gc-notifications-updated"));
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Notifications</h1>
          <p className="text-sm text-slate-500">
            Alertes métiers, sécurité et rappels automatiques (livraisons, caisse, calendrier, ratios).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/notifications/commandes-annulees">Commandes annulées (audit)</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleMarkAll()}>
            Tout marquer comme lu
          </Button>
        </div>
      </section>

      <section className="inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setCategory(opt.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              category === opt.id ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            {opt.label}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total (filtre)</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Infos</p>
              <p className="text-xl font-bold text-slate-900">{stats.info}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Critique / Rappels</p>
              <p className="text-xl font-bold text-slate-900">{stats.critical + stats.reminders}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Flux</CardTitle>
            <CardDescription>
              Priorités : <span className="font-medium text-rose-600">rouge</span> sécurité / annulation,{" "}
              <span className="font-medium text-amber-600">orange</span> rappels,{" "}
              <span className="font-medium text-sky-600">bleu</span> informations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Chargement…
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Aucune notification pour ce filtre.
              </p>
            ) : (
              rows.map((n) => {
                const badge = badgeForPriority(n.priority);
                return (
                  <article
                    key={n.id}
                    className={cn(
                      "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
                      !n.isRead && "ring-1 ring-sky-200",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{n.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                        {!n.isRead ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleMarkRead(n.id)}>
                            Marquer lu
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleString("fr-FR")}
                      {n.link ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={n.link} className="font-medium text-sky-700 hover:underline">
                            Ouvrir
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
