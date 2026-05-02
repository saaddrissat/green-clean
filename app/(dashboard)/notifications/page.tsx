"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarDays, CircleAlert, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Period = "today" | "week" | "month";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  level: "info" | "warning";
  period: Period;
  createdAt: string;
};

const notificationsStorageKey = "gc-notifications-feed";

const allNotifications: NotificationItem[] = [
  {
    id: "NTF-001",
    title: "Pic d'activité détecté",
    message: "Le volume de commandes a augmenté de 18% aujourd'hui.",
    level: "info",
    period: "today",
    createdAt: "Aujourd'hui, 10:42",
  },
  {
    id: "NTF-002",
    title: "Retards à surveiller",
    message: "3 commandes approchent leur échéance dans les 4 prochaines heures.",
    level: "warning",
    period: "today",
    createdAt: "Aujourd'hui, 15:18",
  },
  {
    id: "NTF-003",
    title: "Top catégorie de la semaine",
    message: "Chemises représente 36% des commandes hebdomadaires.",
    level: "info",
    period: "week",
    createdAt: "Lundi, 08:25",
  },
  {
    id: "NTF-004",
    title: "Suivi paiements",
    message: "Le taux de paiement cash est supérieur de 9% à la moyenne.",
    level: "info",
    period: "week",
    createdAt: "Mardi, 11:05",
  },
  {
    id: "NTF-005",
    title: "Alerte panier moyen",
    message: "Le panier moyen du mois est en baisse de 4% par rapport au mois précédent.",
    level: "warning",
    period: "month",
    createdAt: "02/04, 14:30",
  },
  {
    id: "NTF-006",
    title: "Performance mensuelle",
    message: "Chiffre d'affaires mensuel en progression de 12%.",
    level: "info",
    period: "month",
    createdAt: "05/04, 09:10",
  },
];

const periodLabels: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
};

export default function NotificationsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("today");
  const [dynamicNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(notificationsStorageKey) ?? "[]") as NotificationItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const mergedNotifications = useMemo(() => {
    const map = new Map<string, NotificationItem>();
    [...dynamicNotifications, ...allNotifications].forEach((item) => {
      map.set(item.id, item);
    });
    return Array.from(map.values());
  }, [dynamicNotifications]);

  const filteredNotifications = useMemo(
    () => mergedNotifications.filter((item) => item.period === selectedPeriod),
    [mergedNotifications, selectedPeriod],
  );

  const insights = useMemo(() => {
    const infoCount = filteredNotifications.filter((item) => item.level === "info").length;
    const warningCount = filteredNotifications.filter((item) => item.level === "warning").length;
    return {
      total: filteredNotifications.length,
      infoCount,
      warningCount,
    };
  }, [filteredNotifications]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Notifications</h1>
          <p className="text-sm text-slate-500">
            Insights et alertes filtrés par période ({periodLabels[selectedPeriod]}).
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setSelectedPeriod("today")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              selectedPeriod === "today"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod("week")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              selectedPeriod === "week"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod("month")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              selectedPeriod === "month"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Ce mois
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total notifications</p>
              <p className="text-xl font-bold text-slate-900">{insights.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Insights positifs</p>
              <p className="text-xl font-bold text-slate-900">{insights.infoCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Alertes à traiter</p>
              <p className="text-xl font-bold text-slate-900">{insights.warningCount}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Liste des notifications</CardTitle>
            <CardDescription>Affichage des notifications pour {periodLabels[selectedPeriod]}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{notification.title}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        notification.level === "warning"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {notification.level === "warning" ? "Alerte" : "Insight"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{notification.message}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {notification.createdAt.includes("T")
                      ? new Date(notification.createdAt).toLocaleString("fr-FR")
                      : notification.createdAt}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Aucune notification pour cette période.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
