"use client";

import { useMemo, useState } from "react";
import { Bell, Download, Grid3X3, ShoppingCart, Tags, Users } from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardHomeData } from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OrderStatus } from "@/lib/order-status";

const quickActions = [
  {
    title: "Caisse",
    subtitle: "Nouvelle vente",
    icon: ShoppingCart,
    href: "/caisse",
    color: "bg-sky-600",
  },
  {
    title: "Clients",
    subtitle: "Rechercher et suivre",
    icon: Users,
    href: "/clients",
    color: "bg-indigo-600",
  },
  {
    title: "Notifications",
    subtitle: "Alertes du jour",
    icon: Bell,
    href: "/notifications",
    color: "bg-emerald-600",
  },
  {
    title: "Categories",
    subtitle: "Gerer les services",
    icon: Tags,
    href: "/categories",
    color: "bg-amber-600",
  },
];

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function orderInPeriod(createdAtIso: string, days: number): boolean {
  const t = new Date(createdAtIso).getTime();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return t >= start.getTime() && t <= end.getTime();
}

function paymentMethodLabel(method: string): "Espèces" | "Carte bancaire" | "Crédit" {
  if (method === "CASH") return "Espèces";
  if (method === "CARD") return "Carte bancaire";
  return "Crédit";
}

const formatDh = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} DHs`;

const categoryColors = ["#0ea5e9", "#14b8a6", "#38bdf8", "#6366f1"];
const paymentColors = ["#0284c7", "#10b981", "#f59e0b"];
const progressColors = ["#f59e0b", "#38bdf8", "#1e3a8a", "#ec4899"];

const paymentBadgeColors: Record<string, string> = {
  Espèces: "bg-emerald-100 text-emerald-800",
  "Carte bancaire": "bg-sky-100 text-sky-800",
  Crédit: "bg-amber-100 text-amber-800",
};

const statusOrderLabel: Record<OrderStatus, string> = {
  RECU: "Reçu",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  LIVRE: "Livré",
  ANNULE: "Annulé",
};

const statusBadgeClass: Record<OrderStatus, string> = {
  RECU: "bg-slate-100 text-slate-800",
  EN_COURS: "bg-amber-100 text-amber-800",
  TERMINE: "bg-sky-100 text-sky-800",
  LIVRE: "bg-emerald-100 text-emerald-800",
  ANNULE: "bg-rose-100 text-rose-800",
};

type PeriodPreset = 1 | 7 | 30;

type DashboardHomeClientProps = {
  data: DashboardHomeData;
};

export function DashboardHomeClient({ data }: DashboardHomeClientProps) {
  const [periodDays, setPeriodDays] = useState<PeriodPreset>(1);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const periodData = useMemo(() => data.dailySeries.slice(-periodDays), [data.dailySeries, periodDays]);

  const selectedPeriodLabel = useMemo(() => {
    if (periodDays === 1) return "Jour";
    if (periodDays === 7) return "Semaine";
    return "Mois";
  }, [periodDays]);

  const kpis = useMemo(() => {
    const revenue = periodData.reduce((sum, item) => sum + item.revenue, 0);
    const orders = periodData.reduce((sum, item) => sum + item.orders, 0);
    const activeClients =
      periodData.length === 0 ? 0 : Math.max(0, ...periodData.map((item) => item.activeClients));
    const avgBasket = orders > 0 ? Math.round(revenue / orders) : 0;
    return { revenue, orders, activeClients, avgBasket };
  }, [periodData]);

  const categoryBreakdown = useMemo(() => {
    const filtered = data.chartOrders.filter(
      (o) => orderInPeriod(o.createdAt, periodDays) && o.status !== "ANNULE",
    );
    const tally = new Map<string, number>();
    for (const o of filtered) {
      for (const [name, n] of Object.entries(o.categoryUnits)) {
        tally.set(name, (tally.get(name) ?? 0) + n);
      }
    }
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [data.chartOrders, periodDays]);

  const paymentBreakdown = useMemo(() => {
    const filtered = data.chartOrders.filter(
      (o) =>
        orderInPeriod(o.createdAt, periodDays) &&
        o.status === "LIVRE" &&
        Boolean(o.clientId) &&
        o.clientLabel !== "—",
    );
    const tally = new Map<string, number>();
    for (const o of filtered) {
      const label = paymentMethodLabel(o.paymentMethod);
      tally.set(label, (tally.get(label) ?? 0) + 1);
    }
    return [...tally.entries()].map(([name, value]) => ({ name, value }));
  }, [data.chartOrders, periodDays]);

  const orderProgress = useMemo(() => {
    const filtered = data.chartOrders.filter(
      (o) => orderInPeriod(o.createdAt, periodDays) && o.status !== "ANNULE",
    );
    const counts: Record<string, number> = {
      RECU: 0,
      EN_COURS: 0,
      TERMINE: 0,
      LIVRE: 0,
    };
    for (const o of filtered) {
      if (o.status in counts) {
        counts[o.status] += 1;
      }
    }
    const parts = [
      { status: "RECU" as const, name: "Reçu" },
      { status: "EN_COURS" as const, name: "En cours" },
      { status: "TERMINE" as const, name: "Terminé" },
      { status: "LIVRE" as const, name: "Livré" },
    ];
    return parts.map((entry, idx) => ({
      name: entry.name,
      value: counts[entry.status] ?? 0,
      fill: progressColors[idx % progressColors.length],
    }));
  }, [data.chartOrders, periodDays]);

  const paymentTransactions = useMemo(() => {
    return data.chartOrders
      .filter(
        (o) =>
          orderInPeriod(o.createdAt, periodDays) &&
          o.status === "LIVRE" &&
          Boolean(o.clientId) &&
          o.clientLabel !== "—",
      )
      .map((order) => ({
        id: order.orderNumber,
        clientName: order.clientLabel,
        orderNumber: order.orderNumber,
        paymentMethod: paymentMethodLabel(order.paymentMethod),
        amount: order.total,
      }));
  }, [data.chartOrders, periodDays]);

  const transactionRowsForSelectedDay = useMemo(() => {
    const selectedDay = periodData.at(-1);
    if (!selectedDay) return [];

    return data.chartOrders
      .filter(
        (o) =>
          localDayKey(new Date(o.createdAt)) === localDayKey(new Date()) && o.status !== "ANNULE",
      )
      .map((o) => ({
        date: selectedDay.day,
        transactionId: o.orderNumber,
        client: o.clientLabel,
        amount: Math.round(o.total),
      }));
  }, [data.chartOrders, periodData]);

  const exportRevenueReport = () => {
    const csvRows: string[] = [];
    const generatedAt = new Date().toISOString();

    if (periodDays === 1) {
      csvRows.push(["Rapport", "Transactions du jour"].join(","));
      csvRows.push(["Periode", selectedPeriodLabel].join(","));
      csvRows.push(["Genere le", generatedAt].join(","));
      csvRows.push("");
      csvRows.push(["Date", "Transaction", "Client", "Montant (DHs)"].join(","));
      transactionRowsForSelectedDay.forEach((row) => {
        csvRows.push([row.date, row.transactionId, row.client, String(row.amount)].join(","));
      });
    } else {
      csvRows.push(["Rapport", `Chiffre d'affaires par jour (${selectedPeriodLabel})`].join(","));
      csvRows.push(["Periode", selectedPeriodLabel].join(","));
      csvRows.push(["Genere le", generatedAt].join(","));
      csvRows.push("");
      csvRows.push(["Jour", "Chiffre d'affaires (DHs)", "Commandes"].join(","));
      periodData.forEach((row) => {
        csvRows.push([row.day, String(row.revenue), String(row.orders)].join(","));
      });
    }

    const fileName = `rapport-${selectedPeriodLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    const csvContent = `\uFEFF${csvRows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportRevenueReportPdf = () => {
    const periodTitle = `Période : ${selectedPeriodLabel}`;
    const generated = new Date().toLocaleString("fr-FR");
    const revenueTotal = formatDh(kpis.revenue);
    const ordersTotal = new Intl.NumberFormat("fr-FR").format(kpis.orders);

    let bodyContent = "";
    if (periodDays === 1) {
      const rows = transactionRowsForSelectedDay
        .map(
          (row) =>
            `<tr><td>${row.date}</td><td>${row.transactionId}</td><td>${row.client}</td><td>${row.amount}</td></tr>`,
        )
        .join("");
      bodyContent = `
          <h2>Transactions du jour</h2>
          <table>
            <thead><tr><th>Date</th><th>Transaction</th><th>Client</th><th>Montant (DHs)</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#64748b;">Aucune ligne</td></tr>`}</tbody>
          </table>`;
    } else {
      const rows = periodData
        .map(
          (row) =>
            `<tr><td>${row.day}</td><td>${formatDh(row.revenue)}</td><td>${row.orders}</td><td>${row.activeClients}</td></tr>`,
        )
        .join("");
      bodyContent = `
          <h2>Chiffre d&apos;affaires par jour</h2>
          <table>
            <thead><tr><th>Jour</th><th>Chiffre d&apos;affaires</th><th>Commandes</th><th>Clients actifs</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
    }

    const printWindow = window.open("", "_blank", "width=980,height=740");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Export — Revenu par jours</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px 0; }
            h2 { margin-top: 24px; margin-bottom: 8px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f1f5f9; }
            .meta { color: #475569; }
          </style>
        </head>
        <body>
          <h1>Revenu par jours</h1>
          <p class="meta"><strong>${periodTitle}</strong></p>
          <p class="meta"><strong>Généré le :</strong> ${generated}</p>
          <p><strong>CA total :</strong> ${revenueTotal} — <strong>Commandes :</strong> ${ordersTotal}</p>
          ${bodyContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Tableau de bord</h1>
          <p className="text-sm text-slate-500">Suivi des performances et activités.</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {[
            { value: 1 as PeriodPreset, label: "Jour" },
            { value: 7 as PeriodPreset, label: "Semaine" },
            { value: 30 as PeriodPreset, label: "Mois" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriodDays(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                periodDays === option.value
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className={`${action.color} group flex min-h-24 rounded-xl p-3 text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
            >
              <div className="flex w-full items-center justify-between">
                <div>
                  <p className="text-xs text-white/85">{action.subtitle}</p>
                  <h3 className="mt-1 text-base font-semibold">{action.title}</h3>
                </div>
                <div className="rounded-lg bg-white/20 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Chiffre d&apos;affaires</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatDh(kpis.revenue)}</p>
            <p className="mt-1 text-xs text-slate-500">Période: {selectedPeriodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Nombre de commandes</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {new Intl.NumberFormat("fr-FR").format(kpis.orders)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Total commandes enregistrées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Clients actifs</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {new Intl.NumberFormat("fr-FR").format(kpis.activeClients)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Pic d&apos;activité client</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Moyenne par panier</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatDh(kpis.avgBasket)}</p>
            <p className="mt-1 text-xs text-slate-500">CA moyen / commande</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Revenus journaliers</CardTitle>
              <CardDescription>Évolution du chiffre d&apos;affaires journalier.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </CardHeader>
          <CardContent className="h-72 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={periodData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={22} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={64}
                  tickFormatter={(value: number) =>
                    Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))
                  }
                />
                <Tooltip
                  formatter={(value) => [formatDh(Number(value ?? 0)), "Revenu"]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commandes par catégorie</CardTitle>
            <CardDescription>Répartition des commandes sur {periodDays} jours.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-80 flex-col">
            <div className="min-h-0 flex-1">
              {categoryBreakdown.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Aucune donnée sur cette période. Les articles vendus apparaîtront ici.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {categoryBreakdown.map((entry, idx) => (
                        <Cell key={entry.name} fill={categoryColors[idx % categoryColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Unités"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-600">
              {categoryBreakdown.map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: categoryColors[idx % categoryColors.length] }}
                  />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">Commandes par moyen de paiement</CardTitle>
              <CardDescription>Espèces, carte (TPE) et mobile money.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsPaymentDetailsOpen(true)}>
              Voir les détails
            </Button>
          </CardHeader>
          <CardContent className="flex h-80 flex-col">
            <div className="min-h-0 flex-1">
              {paymentBreakdown.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Aucune commande sur cette période.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {paymentBreakdown.map((entry, idx) => (
                        <Cell key={entry.name} fill={paymentColors[idx % paymentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Commandes"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-600">
              {paymentBreakdown.map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: paymentColors[idx % paymentColors.length] }}
                  />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={isPaymentDetailsOpen} onOpenChange={setIsPaymentDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Transactions par moyen de paiement</DialogTitle>
            <DialogDescription>Liste des transactions affichées pour la période en cours.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Commande</th>
                  <th className="px-4 py-3 font-semibold">Montant payé</th>
                  <th className="px-4 py-3 font-semibold">Méthode de paiement</th>
                </tr>
              </thead>
              <tbody>
                {paymentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Aucune transaction sur cette période.
                    </td>
                  </tr>
                ) : (
                  paymentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{transaction.clientName}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{transaction.orderNumber}</td>
                      <td className="px-4 py-3 font-semibold">{formatDh(transaction.amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            paymentBadgeColors[transaction.paymentMethod] ?? "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {transaction.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir le format d&apos;export</DialogTitle>
            <DialogDescription>
              Exporter le graphique « Revenu par jours » pour la période sélectionnée ({selectedPeriodLabel}) en PDF ou
              CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              onClick={() => {
                exportRevenueReportPdf();
                setIsExportDialogOpen(false);
              }}
            >
              Exporter en PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                exportRevenueReport();
                setIsExportDialogOpen(false);
              }}
            >
              Exporter en CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Etat d&apos;avancement des commandes</CardTitle>
            <CardDescription>Vue globale des commandes par etape.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              {orderProgress.map((item) => {
                const max = Math.max(1, ...orderProgress.map((entry) => entry.value));
                const width = `${Math.round((item.value / max) * 100)}%`;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-500">{item.value} cmd.</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200">
                      <div
                        className="h-2.5 rounded-full"
                        style={{ width, backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="h-64">
              {orderProgress.every((e) => e.value === 0) ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Aucune commande en cours sur cette période.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={orderProgress.map((item, idx) => ({
                      ...item,
                      radius: [100 - idx * 18, 112 - idx * 18],
                    }))}
                    innerRadius="30%"
                    outerRadius="100%"
                    startAngle={180}
                    endAngle={-180}
                  >
                    <RadialBar background dataKey="value" cornerRadius={6} />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Dernières commandes</CardTitle>
              <CardDescription>Liste des commandes récentes</CardDescription>
            </div>
            <Button asChild size="lg" variant="outline" className="min-h-12">
              <Link href="/suivi">
                <Grid3X3 className="mr-2 h-5 w-5" />
                Voir tout
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-sm text-slate-500">
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Code commande</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Client</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Date réception</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Échéance livraison</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Prix commande</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border-b border-slate-200 px-4 py-10 text-center text-slate-500">
                      Aucune commande pour le moment. Créez une vente depuis la caisse.
                    </td>
                  </tr>
                ) : (
                  data.recentOrders.map((order) => (
                    <tr key={order.id} className="text-sm text-slate-700">
                      <td className="border-b border-slate-200 px-4 py-4 font-semibold text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-4">{order.client}</td>
                      <td className="border-b border-slate-200 px-4 py-4">{order.receptionDate}</td>
                      <td className="border-b border-slate-200 px-4 py-4">{order.dueDate}</td>
                      <td className="border-b border-slate-200 px-4 py-4 text-right font-semibold">
                        {order.total}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-4 text-right">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[order.status]}`}
                        >
                          {statusOrderLabel[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Meilleurs clients</CardTitle>
            <CardDescription>Clients avec le plus de commandes et de dépenses.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-sm text-slate-500">
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Client</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Contact</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold">Cmd.</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border-b border-slate-200 px-4 py-10 text-center text-slate-500">
                      Aucun client avec commande pour le moment.
                    </td>
                  </tr>
                ) : (
                  data.topClients.map((client, idx) => (
                    <tr key={`${client.name}-${idx}`} className="text-sm text-slate-700">
                    <td className="border-b border-slate-200 px-4 py-4 font-semibold text-slate-900">
                      {client.name}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4">{client.contact}</td>
                    <td className="border-b border-slate-200 px-4 py-4 text-center font-medium">
                      {client.orders}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4 text-right font-semibold">
                      {new Intl.NumberFormat("fr-FR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(client.totalPaid)}{" "}
                      DHs
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
