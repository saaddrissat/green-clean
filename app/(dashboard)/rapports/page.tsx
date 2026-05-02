"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download } from "lucide-react";
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
import { formatMoney } from "@/lib/currency";

const CATEGORY_PARTS = [
  { name: "Chemises", ratio: 0.38 },
  { name: "Pantalons", ratio: 0.29 },
  { name: "Robes", ratio: 0.19 },
  { name: "Literie", ratio: 0.14 },
] as const;

type ReportPeriod = "day" | "week" | "month";

type PaymentMethodLabel = "TPE" | "Cash" | "Crédit";

type TransactionRow = {
  id: string;
  clientName: string;
  orderNumber: string;
  paymentMethod: PaymentMethodLabel;
  amount: number;
  createdAt: string;
};

const paymentMethodColors: Record<PaymentMethodLabel, string> = {
  TPE: "bg-sky-100 text-sky-800",
  Cash: "bg-emerald-100 text-emerald-800",
  Crédit: "bg-amber-100 text-amber-800",
};

const transactions: TransactionRow[] = [
  { id: "tx-1", clientName: "Mehdi", orderNumber: "BL-2026-3947", paymentMethod: "TPE", amount: 1000, createdAt: "2026-04-29T09:30:00.000Z" },
  { id: "tx-2", clientName: "Awa Ndiaye", orderNumber: "BL-2026-3948", paymentMethod: "Cash", amount: 750, createdAt: "2026-04-29T12:15:00.000Z" },
  { id: "tx-3", clientName: "Moussa Diallo", orderNumber: "BL-2026-3949", paymentMethod: "Crédit", amount: 1300, createdAt: "2026-04-28T16:05:00.000Z" },
  { id: "tx-4", clientName: "Fatou Sarr", orderNumber: "BL-2026-3950", paymentMethod: "TPE", amount: 980, createdAt: "2026-04-27T10:40:00.000Z" },
  { id: "tx-5", clientName: "Ibrahima Fall", orderNumber: "BL-2026-3951", paymentMethod: "Cash", amount: 620, createdAt: "2026-04-25T14:20:00.000Z" },
  { id: "tx-6", clientName: "Nora Bertrand", orderNumber: "BL-2026-3952", paymentMethod: "Crédit", amount: 1540, createdAt: "2026-04-19T11:10:00.000Z" },
  { id: "tx-7", clientName: "Samir Girard", orderNumber: "BL-2026-3953", paymentMethod: "TPE", amount: 860, createdAt: "2026-04-10T09:55:00.000Z" },
];

const PROGRESS_PARTS = [
  { name: "Réceptions", ratio: 0.4, fill: "#f59e0b" },
  { name: "En cours de lavage", ratio: 0.27, fill: "#38bdf8" },
  { name: "Repassage", ratio: 0.19, fill: "#1e3a8a" },
  { name: "Prêt pour retrait", ratio: 0.14, fill: "#ec4899" },
] as const;

const categoryColors = ["#0ea5e9", "#14b8a6", "#38bdf8", "#6366f1"];
const paymentColors = ["#0284c7", "#10b981", "#f59e0b"];
const WEEK_DAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

const toDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const toDayEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const isSameDay = (a: Date, b: Date) => toDayStart(a).getTime() === toDayStart(b).getTime();

const startOfWeek = (date: Date) => {
  const d = toDayStart(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const endOfWeek = (date: Date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
const formatDayShort = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);

const buildMonthDays = (monthDate: Date) => {
  const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekStart = startOfWeek(firstDayOfMonth);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstWeekStart);
    day.setDate(firstWeekStart.getDate() + index);
    return day;
  });
};

export default function RapportsPage() {
  const today = useMemo(() => toDayStart(new Date()), []);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("week");
  const [periodStart, setPeriodStart] = useState(startOfWeek(today));
  const [periodEnd, setPeriodEnd] = useState(endOfWeek(today));
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<ReportPeriod>(selectedPeriod);
  const [draftStart, setDraftStart] = useState<Date | null>(periodStart);
  const [draftEnd, setDraftEnd] = useState<Date | null>(periodEnd);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(periodStart));
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const rangeLabel = useMemo(() => {
    if (!periodStart || !periodEnd) return "Sélectionner une période";
    return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;
  }, [periodEnd, periodStart]);

  const openPeriodDialog = () => {
    setDraftMode(selectedPeriod);
    setDraftStart(periodStart);
    setDraftEnd(periodEnd);
    setVisibleMonth(startOfMonth(periodStart));
    setIsPeriodDialogOpen(true);
  };

  const applyPreset = (mode: ReportPeriod) => {
    const now = toDayStart(new Date());
    setDraftMode(mode);
    if (mode === "day") {
      setDraftStart(now);
      setDraftEnd(now);
      setVisibleMonth(startOfMonth(now));
      return;
    }
    if (mode === "week") {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      setDraftStart(start);
      setDraftEnd(end);
      setVisibleMonth(startOfMonth(start));
      return;
    }
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    setDraftStart(start);
    setDraftEnd(end);
    setVisibleMonth(startOfMonth(start));
  };

  const handleDayClick = (date: Date) => {
    const clicked = toDayStart(date);
    if (draftMode === "day") {
      setDraftStart(clicked);
      setDraftEnd(clicked);
      return;
    }
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(clicked);
      setDraftEnd(null);
      return;
    }
    if (clicked.getTime() < draftStart.getTime()) {
      setDraftEnd(draftStart);
      setDraftStart(clicked);
      return;
    }
    setDraftEnd(clicked);
  };

  const saveSelectedPeriod = () => {
    if (!draftStart) return;
    const nextEnd = draftEnd ?? draftStart;
    setSelectedPeriod(draftMode);
    setPeriodStart(toDayStart(draftStart));
    setPeriodEnd(toDayStart(nextEnd));
    setIsPeriodDialogOpen(false);
  };

  const filteredTransactions = useMemo(() => {
    const start = toDayStart(periodStart).getTime();
    const end = toDayEnd(periodEnd).getTime();
    return transactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt).getTime();
      return createdAt >= start && createdAt <= end;
    });
  }, [periodEnd, periodStart]);

  const leftMonthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const monthTitle = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
  const inDraftRange = (day: Date) => {
    if (!draftStart) return false;
    const start = toDayStart(draftStart).getTime();
    const end = toDayStart(draftEnd ?? draftStart).getTime();
    const current = toDayStart(day).getTime();
    return current >= Math.min(start, end) && current <= Math.max(start, end);
  };
  const isRangeEdge = (day: Date) =>
    (draftStart && isSameDay(day, draftStart)) || (draftEnd && isSameDay(day, draftEnd));

  const renderMonth = (monthDate: Date, days: Date[]) => (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-3 text-center text-sm font-semibold capitalize text-slate-900">{monthTitle(monthDate)}</p>
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
        {WEEK_DAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isSelected = inDraftRange(day);
          const isEdge = isRangeEdge(day);
          return (
            <button
              key={`${monthDate.toISOString()}-${day.toISOString()}`}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`h-10 rounded-lg text-sm transition ${
                isEdge
                  ? "bg-sky-600 font-semibold text-white"
                  : isSelected
                    ? "bg-sky-100 text-sky-800"
                    : isCurrentMonth
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-slate-300"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  const paymentBreakdown = useMemo(
    () => [
      { name: "TPE", value: filteredTransactions.filter((item) => item.paymentMethod === "TPE").length },
      { name: "Cash", value: filteredTransactions.filter((item) => item.paymentMethod === "Cash").length },
      { name: "Crédit", value: filteredTransactions.filter((item) => item.paymentMethod === "Crédit").length },
    ],
    [filteredTransactions],
  );

  const revenueChartData = useMemo(() => {
    const byDay = new Map<string, { revenue: number; orders: number }>();
    filteredTransactions.forEach((transaction) => {
      const dayKey = toDayStart(new Date(transaction.createdAt)).toISOString();
      const current = byDay.get(dayKey) ?? { revenue: 0, orders: 0 };
      byDay.set(dayKey, {
        revenue: current.revenue + transaction.amount,
        orders: current.orders + 1,
      });
    });

    const points: Array<{ day: string; revenue: number; expenses: number; orders: number }> = [];
    const cursor = new Date(periodStart);
    while (cursor.getTime() <= periodEnd.getTime()) {
      const dayStart = toDayStart(cursor);
      const dayKey = dayStart.toISOString();
      const current = byDay.get(dayKey) ?? { revenue: 0, orders: 0 };
      points.push({
        day: formatDayShort(dayStart),
        revenue: current.revenue,
        expenses: Math.round(current.revenue * 0.35),
        orders: current.orders,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }, [filteredTransactions, periodEnd, periodStart]);

  const categoryBreakdown = useMemo(() => {
    const totalOrders = filteredTransactions.length;
    return CATEGORY_PARTS.map((item) => ({
      name: item.name,
      value: totalOrders === 0 ? 0 : Math.max(1, Math.round(totalOrders * item.ratio)),
    }));
  }, [filteredTransactions]);

  const progressData = useMemo(() => {
    const totalOrders = filteredTransactions.length;
    return PROGRESS_PARTS.map((item) => ({
      name: item.name,
      value: totalOrders === 0 ? 0 : Math.max(1, Math.round(totalOrders * item.ratio)),
      fill: item.fill,
    }));
  }, [filteredTransactions]);

  const totalPaidAmount = useMemo(
    () => filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [filteredTransactions],
  );

  const totalEstimatedExpenses = useMemo(
    () => revenueChartData.reduce((sum, entry) => sum + entry.expenses, 0),
    [revenueChartData],
  );

  const totalCategoryOrders = useMemo(
    () => categoryBreakdown.reduce((sum, category) => sum + category.value, 0),
    [categoryBreakdown],
  );

  const totalPaymentOrders = useMemo(
    () => paymentBreakdown.reduce((sum, payment) => sum + payment.value, 0),
    [paymentBreakdown],
  );

  const exportSelectedPeriodReport = () => {
    const csvRows: string[] = [];
    const generatedAt = new Date().toISOString();
    const safePeriod = selectedPeriod === "day" ? "jour" : selectedPeriod === "week" ? "semaine" : "mois";

    csvRows.push(["Rapport", "Synthèse période sélectionnée"].join(","));
    csvRows.push(["Période", rangeLabel].join(","));
    csvRows.push(["Généré le", generatedAt].join(","));
    csvRows.push([]);

    csvRows.push(["Résumé", "Valeur"].join(","));
    csvRows.push(["Commandes payées (nombre)", String(filteredTransactions.length)].join(","));
    csvRows.push(["Commandes payées (montant)", String(totalPaidAmount)].join(","));
    csvRows.push(["Dépenses estimées (montant)", String(totalEstimatedExpenses)].join(","));
    csvRows.push([]);

    csvRows.push(["Commandes payées - détail"].join(","));
    csvRows.push(["Client", "Commande", "Moyen paiement", "Montant", "Date"].join(","));
    filteredTransactions.forEach((transaction) => {
      csvRows.push(
        [
          transaction.clientName,
          transaction.orderNumber,
          transaction.paymentMethod,
          String(transaction.amount),
          transaction.createdAt,
        ].join(","),
      );
    });
    if (filteredTransactions.length === 0) {
      csvRows.push(["Aucune donnée sur la période"].join(","));
    }
    csvRows.push([]);

    csvRows.push(["Pourcentage commandes par catégorie"].join(","));
    csvRows.push(["Catégorie", "Commandes", "Pourcentage"].join(","));
    categoryBreakdown.forEach((category) => {
      const ratio = totalCategoryOrders > 0 ? (category.value / totalCategoryOrders) * 100 : 0;
      csvRows.push([category.name, String(category.value), `${ratio.toFixed(2)}%`].join(","));
    });
    csvRows.push([]);

    csvRows.push(["Pourcentage paiements de commandes"].join(","));
    csvRows.push(["Moyen paiement", "Commandes", "Pourcentage"].join(","));
    paymentBreakdown.forEach((payment) => {
      const ratio = totalPaymentOrders > 0 ? (payment.value / totalPaymentOrders) * 100 : 0;
      csvRows.push([payment.name, String(payment.value), `${ratio.toFixed(2)}%`].join(","));
    });

    const fileName = `rapport-${safePeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const exportSelectedPeriodReportPdf = () => {
    const categoryLines = categoryBreakdown
      .map((category) => {
        const ratio = totalCategoryOrders > 0 ? (category.value / totalCategoryOrders) * 100 : 0;
        return `<li>${category.name}: ${category.value} (${ratio.toFixed(2)}%)</li>`;
      })
      .join("");

    const paymentLines = paymentBreakdown
      .map((payment) => {
        const ratio = totalPaymentOrders > 0 ? (payment.value / totalPaymentOrders) * 100 : 0;
        return `<li>${payment.name}: ${payment.value} (${ratio.toFixed(2)}%)</li>`;
      })
      .join("");

    const transactionRows =
      filteredTransactions.length > 0
        ? filteredTransactions
            .map(
              (transaction) =>
                `<tr>
                  <td>${transaction.clientName}</td>
                  <td>${transaction.orderNumber}</td>
                  <td>${transaction.paymentMethod}</td>
                  <td>${formatMoney(transaction.amount)}</td>
                  <td>${new Date(transaction.createdAt).toLocaleString("fr-FR")}</td>
                </tr>`,
            )
            .join("")
        : `<tr><td colspan="5" style="text-align:center;color:#64748b;">Aucune transaction pour cette période</td></tr>`;

    const printWindow = window.open("", "_blank", "width=980,height=740");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Rapport - ${rangeLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px 0; }
            h2 { margin-top: 24px; margin-bottom: 8px; font-size: 18px; }
            p { margin: 6px 0; }
            ul { margin: 8px 0 0 16px; padding: 0; }
            li { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f1f5f9; }
            .meta { color: #475569; }
          </style>
        </head>
        <body>
          <h1>Rapport de performance</h1>
          <p class="meta"><strong>Période:</strong> ${rangeLabel}</p>
          <p class="meta"><strong>Généré le:</strong> ${new Date().toLocaleString("fr-FR")}</p>

          <h2>Résumé</h2>
          <p><strong>Commandes payées:</strong> ${filteredTransactions.length}</p>
          <p><strong>Montant commandes payées:</strong> ${formatMoney(totalPaidAmount)}</p>
          <p><strong>Dépenses estimées:</strong> ${formatMoney(totalEstimatedExpenses)}</p>

          <h2>Pourcentage commandes par catégorie</h2>
          <ul>${categoryLines}</ul>

          <h2>Pourcentage paiements de commandes</h2>
          <ul>${paymentLines}</ul>

          <h2>Détail commandes payées</h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Commande</th>
                <th>Moyen paiement</th>
                <th>Montant</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
            </tbody>
          </table>
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
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Rapports</h1>
          <p className="text-sm text-slate-500">Graphiques et diagrammes de performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={openPeriodDialog}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {rangeLabel}
          </Button>
          <Button type="button" onClick={() => setIsExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenu par jours</CardTitle>
            <CardDescription>Évolution du chiffre d&apos;affaires journalier.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFillReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="expensesFillReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                <Tooltip
                  formatter={(value, name) => [formatMoney(Number(value ?? 0)), name === "expenses" ? "Dépenses" : "Revenu"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fill="url(#revenueFillReports)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#dc2626"
                  strokeWidth={2}
                  fill="url(#expensesFillReports)"
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
            <CardDescription>Répartition sur la semaine.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-80 flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
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

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <Card
            className="cursor-pointer transition hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setIsPaymentDialogOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsPaymentDialogOpen(true);
              }
            }}
          >
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Commandes par moyen de paiement</CardTitle>
                <CardDescription>Répartition TPE, Cash et Crédit.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPaymentDialogOpen(true);
                }}
              >
                Voir les détails
              </Button>
            </CardHeader>
            <CardContent className="flex h-80 flex-col">
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Transactions par moyen de paiement</DialogTitle>
              <DialogDescription>Transactions de la période sélectionnée ({selectedPeriod}).</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Commande</th>
                    <th className="px-4 py-3 font-semibold">Moyen de paiement</th>
                    <th className="px-4 py-3 font-semibold">Montant payé</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{transaction.clientName}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{transaction.orderNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentMethodColors[transaction.paymentMethod]}`}>
                          {transaction.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatMoney(transaction.amount)}</td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Aucune transaction pour cette période.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      <Dialog open={isPeriodDialogOpen} onOpenChange={setIsPeriodDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Période des rapports</DialogTitle>
            <DialogDescription>
              Choisissez Jour, Semaine ou Mois puis sélectionnez une période sur le calendrier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              {[
                { label: "Jour", value: "day" as ReportPeriod },
                { label: "Semaine", value: "week" as ReportPeriod },
                { label: "Mois", value: "month" as ReportPeriod },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => applyPreset(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    draftMode === option.value ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm text-slate-600">
                {draftStart ? formatDate(draftStart) : "Début"} - {draftEnd ? formatDate(draftEnd) : "Fin"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div>{renderMonth(visibleMonth, leftMonthDays)}</div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPeriodDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={saveSelectedPeriod}>
                Appliquer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir le format d&apos;export</DialogTitle>
            <DialogDescription>Exporter le rapport de la période sélectionnée en PDF ou CSV.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              onClick={() => {
                exportSelectedPeriodReportPdf();
                setIsExportDialogOpen(false);
              }}
            >
              Exporter en PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                exportSelectedPeriodReport();
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
            <CardDescription>Vue globale des commandes par étape.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              {progressData.map((item) => {
                const max = Math.max(1, ...progressData.map((entry) => entry.value));
                const width = `${Math.round((item.value / max) * 100)}%`;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-500">{item.value} cmd.</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200">
                      <div className="h-2.5 rounded-full" style={{ width, backgroundColor: item.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart data={progressData} innerRadius="30%" outerRadius="100%" startAngle={180} endAngle={-180}>
                  <RadialBar background dataKey="value" cornerRadius={6} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
