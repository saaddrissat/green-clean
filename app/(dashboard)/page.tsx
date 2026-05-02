"use client";

import { useMemo, useState } from "react";
import { Bell, Download, Grid3X3, ShoppingCart, Tags, TrendingUp, Users } from "lucide-react";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type RecentOrderStatus = "En cours" | "Payée" | "Livrée";

type RecentOrder = {
  id: string;
  client: string;
  receptionDate: string;
  dueDate: string;
  total: string;
  status: RecentOrderStatus;
};

const initialRecentOrders: RecentOrder[] = [
  {
    id: "BL-2026-00152",
    client: "Awa Ndiaye",
    receptionDate: "2026-04-28 18:42",
    dueDate: "2026-04-30",
    total: "12 500 DHs",
    status: "Payée",
  },
  {
    id: "BL-2026-00151",
    client: "Moussa Diallo",
    receptionDate: "2026-04-28 17:10",
    dueDate: "2026-04-29",
    total: "8 000 DHs",
    status: "En cours",
  },
  {
    id: "BL-2026-00150",
    client: "Fatou Sarr",
    receptionDate: "2026-04-28 16:25",
    dueDate: "2026-04-30",
    total: "15 750 DHs",
    status: "Payée",
  },
  {
    id: "BL-2026-00149",
    client: "Ibrahima Fall",
    receptionDate: "2026-04-28 15:03",
    dueDate: "2026-04-29",
    total: "5 500 DHs",
    status: "Livrée",
  },
];

const topClients = [
  { name: "Tara André", contact: "06 60 92 49 62", orders: 13, totalPaid: 672.5 },
  { name: "Nora Bertrand", contact: "06 71 72 93 17", orders: 15, totalPaid: 666.5 },
  { name: "Samir Girard", contact: "06 56 83 20 99", orders: 12, totalPaid: 573.5 },
  { name: "Inès Laurent", contact: "06 53 82 38 50", orders: 9, totalPaid: 534.0 },
  { name: "Julien Simon", contact: "06 13 14 60 63", orders: 10, totalPaid: 506.5 },
  { name: "Karim Michel", contact: "06 32 68 28 37", orders: 12, totalPaid: 486.5 },
  { name: "David Petit", contact: "06 77 37 27 55", orders: 12, totalPaid: 466.0 },
] as const;

const revenueSeries90d = [
  { day: "J-89", revenue: 8300, orders: 31, activeClients: 22 },
  { day: "J-88", revenue: 7900, orders: 28, activeClients: 20 },
  { day: "J-87", revenue: 9100, orders: 33, activeClients: 24 },
  { day: "J-86", revenue: 10200, orders: 36, activeClients: 26 },
  { day: "J-85", revenue: 8800, orders: 30, activeClients: 23 },
  { day: "J-84", revenue: 9700, orders: 34, activeClients: 25 },
  { day: "J-83", revenue: 11100, orders: 39, activeClients: 28 },
  { day: "J-82", revenue: 12000, orders: 43, activeClients: 30 },
  { day: "J-81", revenue: 9300, orders: 32, activeClients: 24 },
  { day: "J-80", revenue: 8700, orders: 29, activeClients: 21 },
  { day: "J-79", revenue: 9900, orders: 35, activeClients: 25 },
  { day: "J-78", revenue: 10600, orders: 38, activeClients: 27 },
  { day: "J-77", revenue: 9600, orders: 34, activeClients: 24 },
  { day: "J-76", revenue: 11500, orders: 40, activeClients: 29 },
  { day: "J-75", revenue: 11800, orders: 41, activeClients: 31 },
  { day: "J-74", revenue: 10900, orders: 37, activeClients: 27 },
  { day: "J-73", revenue: 9300, orders: 31, activeClients: 22 },
  { day: "J-72", revenue: 9800, orders: 34, activeClients: 24 },
  { day: "J-71", revenue: 10400, orders: 37, activeClients: 26 },
  { day: "J-70", revenue: 11700, orders: 42, activeClients: 30 },
  { day: "J-69", revenue: 12100, orders: 43, activeClients: 31 },
  { day: "J-68", revenue: 9400, orders: 32, activeClients: 23 },
  { day: "J-67", revenue: 8800, orders: 30, activeClients: 22 },
  { day: "J-66", revenue: 10100, orders: 35, activeClients: 25 },
  { day: "J-65", revenue: 11300, orders: 39, activeClients: 28 },
  { day: "J-64", revenue: 11600, orders: 40, activeClients: 29 },
  { day: "J-63", revenue: 12200, orders: 44, activeClients: 32 },
  { day: "J-62", revenue: 9700, orders: 33, activeClients: 24 },
  { day: "J-61", revenue: 9100, orders: 31, activeClients: 23 },
  { day: "J-60", revenue: 10800, orders: 37, activeClients: 27 },
  { day: "J-59", revenue: 11200, orders: 39, activeClients: 28 },
  { day: "J-58", revenue: 11900, orders: 42, activeClients: 30 },
  { day: "J-57", revenue: 12400, orders: 45, activeClients: 33 },
  { day: "J-56", revenue: 9700, orders: 33, activeClients: 24 },
  { day: "J-55", revenue: 9800, orders: 34, activeClients: 25 },
  { day: "J-54", revenue: 10500, orders: 36, activeClients: 26 },
  { day: "J-53", revenue: 11100, orders: 38, activeClients: 28 },
  { day: "J-52", revenue: 12300, orders: 44, activeClients: 32 },
  { day: "J-51", revenue: 12800, orders: 46, activeClients: 34 },
  { day: "J-50", revenue: 9900, orders: 34, activeClients: 24 },
  { day: "J-49", revenue: 9400, orders: 32, activeClients: 23 },
  { day: "J-48", revenue: 10800, orders: 37, activeClients: 27 },
  { day: "J-47", revenue: 11800, orders: 41, activeClients: 30 },
  { day: "J-46", revenue: 11400, orders: 40, activeClients: 29 },
  { day: "J-45", revenue: 12700, orders: 45, activeClients: 33 },
  { day: "J-44", revenue: 13200, orders: 47, activeClients: 35 },
  { day: "J-43", revenue: 10100, orders: 35, activeClients: 25 },
  { day: "J-42", revenue: 9500, orders: 33, activeClients: 24 },
  { day: "J-41", revenue: 10900, orders: 38, activeClients: 27 },
  { day: "J-40", revenue: 11600, orders: 40, activeClients: 29 },
  { day: "J-39", revenue: 12600, orders: 44, activeClients: 32 },
  { day: "J-38", revenue: 13000, orders: 46, activeClients: 34 },
  { day: "J-37", revenue: 10200, orders: 35, activeClients: 25 },
  { day: "J-36", revenue: 9700, orders: 33, activeClients: 24 },
  { day: "J-35", revenue: 11200, orders: 39, activeClients: 28 },
  { day: "J-34", revenue: 11900, orders: 42, activeClients: 30 },
  { day: "J-33", revenue: 12400, orders: 44, activeClients: 31 },
  { day: "J-32", revenue: 13300, orders: 48, activeClients: 35 },
  { day: "J-31", revenue: 10600, orders: 36, activeClients: 26 },
  { day: "J-30", revenue: 9900, orders: 34, activeClients: 24 },
  { day: "J-29", revenue: 11500, orders: 40, activeClients: 29 },
  { day: "J-28", revenue: 12100, orders: 42, activeClients: 30 },
  { day: "J-27", revenue: 12600, orders: 45, activeClients: 32 },
  { day: "J-26", revenue: 13700, orders: 49, activeClients: 36 },
  { day: "J-25", revenue: 10800, orders: 37, activeClients: 27 },
  { day: "J-24", revenue: 10200, orders: 35, activeClients: 25 },
  { day: "J-23", revenue: 11700, orders: 41, activeClients: 29 },
  { day: "J-22", revenue: 12300, orders: 43, activeClients: 31 },
  { day: "J-21", revenue: 13100, orders: 47, activeClients: 34 },
  { day: "J-20", revenue: 13900, orders: 50, activeClients: 37 },
  { day: "J-19", revenue: 11200, orders: 38, activeClients: 28 },
  { day: "J-18", revenue: 10400, orders: 36, activeClients: 26 },
  { day: "J-17", revenue: 11800, orders: 41, activeClients: 30 },
  { day: "J-16", revenue: 12500, orders: 44, activeClients: 32 },
  { day: "J-15", revenue: 13300, orders: 47, activeClients: 34 },
  { day: "J-14", revenue: 14100, orders: 51, activeClients: 38 },
  { day: "J-13", revenue: 11500, orders: 39, activeClients: 28 },
  { day: "J-12", revenue: 10700, orders: 37, activeClients: 27 },
  { day: "J-11", revenue: 12100, orders: 42, activeClients: 30 },
  { day: "J-10", revenue: 12900, orders: 45, activeClients: 33 },
  { day: "J-9", revenue: 13600, orders: 48, activeClients: 35 },
  { day: "J-8", revenue: 14400, orders: 52, activeClients: 38 },
  { day: "J-7", revenue: 11800, orders: 40, activeClients: 29 },
  { day: "J-6", revenue: 11100, orders: 38, activeClients: 28 },
  { day: "J-5", revenue: 12600, orders: 44, activeClients: 31 },
  { day: "J-4", revenue: 13200, orders: 46, activeClients: 33 },
  { day: "J-3", revenue: 13900, orders: 49, activeClients: 35 },
  { day: "J-2", revenue: 14700, orders: 53, activeClients: 39 },
  { day: "J-1", revenue: 15300, orders: 55, activeClients: 41 },
  { day: "Aujourd'hui", revenue: 15800, orders: 57, activeClients: 42 },
] as const;

const formatDh = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} DHs`;

const categoryColors = ["#0ea5e9", "#14b8a6", "#38bdf8", "#6366f1"];
const paymentColors = ["#0284c7", "#10b981", "#f59e0b"];
const progressColors = ["#f59e0b", "#38bdf8", "#1e3a8a", "#ec4899"];
const paymentBadgeColors: Record<"TPE" | "Cash" | "Crédit", string> = {
  TPE: "bg-sky-100 text-sky-800",
  Cash: "bg-emerald-100 text-emerald-800",
  Crédit: "bg-amber-100 text-amber-800",
};

type PeriodPreset = 1 | 7 | 30;

export default function DashboardHomePage() {
  const [periodDays, setPeriodDays] = useState<PeriodPreset>(1);
  const [recentOrders, setRecentOrders] = useState(initialRecentOrders);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);

  const periodData = useMemo(() => revenueSeries90d.slice(-periodDays), [periodDays]);

  const selectedPeriodLabel = useMemo(() => {
    if (periodDays === 1) return "Jour";
    if (periodDays === 7) return "Semaine";
    return "Mois";
  }, [periodDays]);

  const kpis = useMemo(() => {
    const revenue = periodData.reduce((sum, item) => sum + item.revenue, 0);
    const orders = periodData.reduce((sum, item) => sum + item.orders, 0);
    const activeClients = Math.max(...periodData.map((item) => item.activeClients));
    const avgBasket = orders > 0 ? Math.round(revenue / orders) : 0;
    return { revenue, orders, activeClients, avgBasket };
  }, [periodData]);

  const categoryBreakdown = useMemo(() => {
    const totalOrders = periodData.reduce((sum, item) => sum + item.orders, 0);
    const parts = [
      { name: "Chemises", ratio: 0.38 },
      { name: "Pantalons", ratio: 0.29 },
      { name: "Robes", ratio: 0.19 },
      { name: "Literie", ratio: 0.14 },
    ];
    return parts.map((entry) => ({
      name: entry.name,
      value: Math.max(1, Math.round(totalOrders * entry.ratio)),
    }));
  }, [periodData]);

  const paymentBreakdown = useMemo(() => {
    const totalOrders = periodData.reduce((sum, item) => sum + item.orders, 0);
    const parts = [
      { name: "TPE", ratio: 0.45 },
      { name: "Cash", ratio: 0.4 },
      { name: "Crédit", ratio: 0.15 },
    ];
    return parts.map((entry) => ({
      name: entry.name,
      value: Math.max(1, Math.round(totalOrders * entry.ratio)),
    }));
  }, [periodData]);

  const orderProgress = useMemo(() => {
    const totalOrders = periodData.reduce((sum, item) => sum + item.orders, 0);
    const parts = [
      { name: "Receptions", ratio: 0.4 },
      { name: "En cours de lavage", ratio: 0.27 },
      { name: "Repassage", ratio: 0.19 },
      { name: "Pret pour retrait", ratio: 0.14 },
    ];
    return parts.map((entry, idx) => ({
      name: entry.name,
      value: Math.max(1, Math.round(totalOrders * entry.ratio)),
      fill: progressColors[idx % progressColors.length],
    }));
  }, [periodData]);

  const paymentTransactions = useMemo(() => {
    const methods: Array<"TPE" | "Cash" | "Crédit"> = ["TPE", "Cash", "Crédit", "TPE"];
    return recentOrders.map((order, index) => ({
      id: order.id,
      clientName: order.client,
      orderNumber: order.id,
      paymentMethod: methods[index % methods.length],
      amount: Number(order.total.replace(/[^\d]/g, "")) || 0,
    }));
  }, [recentOrders]);

  const transactionRowsForSelectedDay = useMemo(() => {
    const selectedDay = periodData.at(-1);
    if (!selectedDay) return [];

    const amountPool = [3200, 2800, 2400, 2100, 1800, 1600, 1400, 1200, 1000, 900];
    const rows = amountPool.map((baseAmount, index) => ({
      date: selectedDay.day,
      transactionId: `TRX-${selectedDay.day.replaceAll(" ", "").toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      client: topClients[index % topClients.length]?.name ?? "Client",
      amount: baseAmount,
    }));

    const targetRevenue = selectedDay.revenue;
    const currentTotal = rows.reduce((sum, row) => sum + row.amount, 0);
    const delta = targetRevenue - currentTotal;
    if (rows.length > 0 && delta !== 0) {
      rows[rows.length - 1] = {
        ...rows[rows.length - 1],
        amount: Math.max(200, rows[rows.length - 1].amount + delta),
      };
    }

    return rows;
  }, [periodData]);

  const exportRevenueReport = () => {
    const csvRows: string[] = [];
    const generatedAt = new Date().toISOString();

    if (periodDays === 1) {
      csvRows.push(["Rapport", "Transactions du jour"].join(","));
      csvRows.push(["Periode", selectedPeriodLabel].join(","));
      csvRows.push(["Genere le", generatedAt].join(","));
      csvRows.push([]);
      csvRows.push(["Date", "Transaction", "Client", "Montant (DHs)"].join(","));
      transactionRowsForSelectedDay.forEach((row) => {
        csvRows.push([row.date, row.transactionId, row.client, String(row.amount)].join(","));
      });
    } else {
      csvRows.push(["Rapport", `Chiffre d'affaires par jour (${selectedPeriodLabel})`].join(","));
      csvRows.push(["Periode", selectedPeriodLabel].join(","));
      csvRows.push(["Genere le", generatedAt].join(","));
      csvRows.push([]);
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
              <CardTitle className="text-lg">Revenu par jours</CardTitle>
              <CardDescription>Évolution du chiffre d&apos;affaires journalier.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={exportRevenueReport}>
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
                <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
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
                  <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Commandes"]} />
                </PieChart>
              </ResponsiveContainer>
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
              <CardDescription>Répartition TPE, Cash et Crédit.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsPaymentDetailsOpen(true)}>
              Voir les détails
            </Button>
          </CardHeader>
          <CardContent className="flex h-80 flex-col">
            <div className="min-h-0 flex-1">
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
                {paymentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{transaction.clientName}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{transaction.orderNumber}</td>
                    <td className="px-4 py-3 font-semibold">{formatDh(transaction.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadgeColors[transaction.paymentMethod]}`}>
                        {transaction.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                const max = Math.max(...orderProgress.map((entry) => entry.value));
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
                {recentOrders.map((order) => (
                  <tr key={order.id} className="text-sm text-slate-700">
                    <td className="border-b border-slate-200 px-4 py-4 font-semibold text-slate-900">
                      {order.id}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4">{order.client}</td>
                    <td className="border-b border-slate-200 px-4 py-4">{order.receptionDate}</td>
                    <td className="border-b border-slate-200 px-4 py-4">{order.dueDate}</td>
                    <td className="border-b border-slate-200 px-4 py-4 text-right font-semibold">
                      {order.total}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4 text-right">
                      <select
                        value={order.status}
                        onChange={(event) =>
                          setRecentOrders((prev) =>
                            prev.map((entry) =>
                              entry.id === order.id
                                ? {
                                    ...entry,
                                    status: event.target.value as RecentOrderStatus,
                                  }
                                : entry,
                            ),
                          )
                        }
                        className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                      >
                        <option value="En cours">En cours</option>
                        <option value="Payée">Payée</option>
                        <option value="Livrée">Livrée</option>
                      </select>
                    </td>
                  </tr>
                ))}
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
                {topClients.map((client) => (
                  <tr key={client.name} className="text-sm text-slate-700">
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
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
