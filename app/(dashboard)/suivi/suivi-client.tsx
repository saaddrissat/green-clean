"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { OrderStatus } from "@prisma/client";

import { updateOrderStatusAction } from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatXof } from "@/hooks/use-pos-cart";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  total: number;
  dueDate: string;
  createdAt: string;
  cashierId: string;
  client: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    optionLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

const statusTabs: Array<{ key: OrderStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "Tous" },
  { key: "RECU", label: "Recu" },
  { key: "EN_COURS", label: "En cours" },
  { key: "TERMINE", label: "Termine" },
  { key: "LIVRE", label: "Livre" },
];

const statusBadgeClass: Record<OrderStatus, string> = {
  RECU: "bg-slate-100 text-slate-800",
  EN_COURS: "bg-amber-100 text-amber-800",
  TERMINE: "bg-emerald-100 text-emerald-800",
  LIVRE: "bg-sky-100 text-sky-800",
};

const nextLabel: Partial<Record<OrderStatus, string>> = {
  RECU: "Marquer En cours",
  EN_COURS: "Marquer Termine",
  TERMINE: "Marquer Livre",
};

type SuiviClientProps = {
  initialOrders: OrderRow[];
};

type PeriodMode = "day" | "week" | "month";

const dayNames = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const atStartOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const atEndOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getWeekRange = (value: Date) => {
  const start = new Date(value);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getMonthRange = (value: Date) => {
  const start = new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

export function SuiviClient({ initialOrders }: SuiviClientProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeStatus, setActiveStatus] = useState<OrderStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [dragAnchor, setDragAnchor] = useState<Date | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const targetDate = atStartOfDay(selectedDate);
    const week = getWeekRange(targetDate);
    const month = getMonthRange(targetDate);
    const hasCustomRange = Boolean(rangeStart && rangeEnd);
    const customStart = rangeStart ? atStartOfDay(rangeStart) : null;
    const customEnd = rangeEnd ? atEndOfDay(rangeEnd) : null;

    return orders.filter((order) => {
      const matchStatus = activeStatus === "ALL" || order.status === activeStatus;
      if (!matchStatus) return false;
      const createdAt = new Date(order.createdAt);
      let matchPeriod = true;
      if (hasCustomRange && customStart && customEnd) {
        matchPeriod = createdAt >= customStart && createdAt <= customEnd;
      } else if (periodMode === "day") {
        matchPeriod = isSameDay(createdAt, targetDate);
      } else if (periodMode === "week") {
        matchPeriod = createdAt >= week.start && createdAt <= week.end;
      } else if (periodMode === "month") {
        matchPeriod = createdAt >= month.start && createdAt <= month.end;
      }
      if (!matchPeriod) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        (order.client?.fullName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orders, activeStatus, query, periodMode, selectedDate, rangeStart, rangeEnd]);

  const statusCounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const targetDate = atStartOfDay(selectedDate);
    const week = getWeekRange(targetDate);
    const month = getMonthRange(targetDate);
    const hasCustomRange = Boolean(rangeStart && rangeEnd);
    const customStart = rangeStart ? atStartOfDay(rangeStart) : null;
    const customEnd = rangeEnd ? atEndOfDay(rangeEnd) : null;

    const baseFiltered = orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      let matchPeriod = true;
      if (hasCustomRange && customStart && customEnd) {
        matchPeriod = createdAt >= customStart && createdAt <= customEnd;
      } else if (periodMode === "day") {
        matchPeriod = isSameDay(createdAt, targetDate);
      } else if (periodMode === "week") {
        matchPeriod = createdAt >= week.start && createdAt <= week.end;
      } else if (periodMode === "month") {
        matchPeriod = createdAt >= month.start && createdAt <= month.end;
      }
      if (!matchPeriod) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        (order.client?.fullName.toLowerCase().includes(q) ?? false)
      );
    });

    return {
      ALL: baseFiltered.length,
      RECU: baseFiltered.filter((order) => order.status === "RECU").length,
      EN_COURS: baseFiltered.filter((order) => order.status === "EN_COURS").length,
      TERMINE: baseFiltered.filter((order) => order.status === "TERMINE").length,
      LIVRE: baseFiltered.filter((order) => order.status === "LIVRE").length,
    };
  }, [orders, periodMode, query, selectedDate, rangeStart, rangeEnd]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const leadingBlank = (firstDayOfMonth.getDay() + 6) % 7;
    const cells: Array<Date | null> = [];
    for (let index = 0; index < leadingBlank; index += 1) cells.push(null);
    for (let day = 1; day <= lastDayOfMonth.getDate(); day += 1) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }
    return cells;
  }, [calendarMonth]);

  const periodLabel = useMemo(() => {
    if (rangeStart && rangeEnd) {
      return `Période: ${rangeStart.toLocaleDateString("fr-FR")} - ${rangeEnd.toLocaleDateString("fr-FR")}`;
    }
    if (periodMode === "day") {
      return `Jour: ${selectedDate.toLocaleDateString("fr-FR", { dateStyle: "medium" })}`;
    }
    if (periodMode === "week") {
      const range = getWeekRange(selectedDate);
      return `Semaine: ${range.start.toLocaleDateString("fr-FR")} - ${range.end.toLocaleDateString("fr-FR")}`;
    }
    return `Mois: ${selectedDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
  }, [periodMode, selectedDate, rangeStart, rangeEnd]);

  const setRangeFromBounds = (first: Date, second: Date) => {
    const start = atStartOfDay(first <= second ? first : second);
    const end = atStartOfDay(first <= second ? second : first);
    setRangeStart(start);
    setRangeEnd(end);
    setSelectedDate(start);
  };

  const handleCalendarDayClick = (day: Date) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      const normalized = atStartOfDay(day);
      setRangeStart(normalized);
      setRangeEnd(null);
      setSelectedDate(normalized);
      return;
    }
    setRangeFromBounds(rangeStart, day);
  };

  const isInRange = (day: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    const value = atStartOfDay(day).getTime();
    return value >= atStartOfDay(rangeStart).getTime() && value <= atStartOfDay(rangeEnd).getTime();
  };

  const handleAdvanceStatus = (orderId: string) => {
    startTransition(async () => {
      try {
        const updated = await updateOrderStatusAction(orderId);
        setOrders((prev) =>
          prev.map((order) => (order.id === updated.id ? { ...order, status: updated.status } : order)),
        );
      } catch {
        // keep optimistic UI simple for now
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Suivi de commandes</CardTitle>
            <CardDescription>Suivi des commandes actives et avancement de production.</CardDescription>
          </div>
          <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="min-h-12 justify-start md:min-w-72">
                <CalendarDays className="mr-2 h-4 w-4" />
                {periodLabel}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Filtrer par période</DialogTitle>
                <DialogDescription>Sélectionnez Jour, Semaine ou Mois puis une date.</DialogDescription>
              </DialogHeader>
              <div className="mb-4 inline-flex w-full rounded-full border border-slate-200 bg-slate-50 p-1">
                {[
                  { key: "day", label: "Jour" },
                  { key: "week", label: "Semaine" },
                  { key: "month", label: "Mois" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriodMode(option.key as PeriodMode)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      periodMode === option.key
                        ? "bg-sky-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-4 rounded-xl border border-slate-200 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-slate-800">
                    {calendarMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </p>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
                  {dayNames.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) =>
                    day ? (
                      <button
                        key={`${day.toISOString()}-${index}`}
                        type="button"
                        className={`h-9 rounded-md text-sm transition ${
                          (rangeStart && isSameDay(day, rangeStart)) || (rangeEnd && isSameDay(day, rangeEnd))
                            ? "bg-sky-600 text-white"
                            : isInRange(day)
                              ? "bg-sky-100 text-sky-900"
                              : isSameDay(day, selectedDate)
                                ? "bg-sky-600 text-white"
                                : "text-slate-700 hover:bg-slate-100"
                        }`}
                        onClick={() => handleCalendarDayClick(day)}
                        onMouseDown={() => {
                          setDragAnchor(day);
                          setIsDraggingRange(true);
                          setRangeStart(atStartOfDay(day));
                          setRangeEnd(atStartOfDay(day));
                        }}
                        onMouseEnter={() => {
                          if (!isDraggingRange || !dragAnchor) return;
                          setRangeFromBounds(dragAnchor, day);
                        }}
                        onMouseUp={() => {
                          setIsDraggingRange(false);
                          setDragAnchor(null);
                        }}
                      >
                        {day.getDate()}
                      </button>
                    ) : (
                      <span key={`blank-${index}`} className="h-9" />
                    ),
                  )}
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRangeStart(null);
                    setRangeEnd(null);
                  }}
                >
                  Réinitialiser période
                </Button>
                <Button type="button" onClick={() => setIsCalendarOpen(false)}>
                  Appliquer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStatus(tab.key)}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                  activeStatus === tab.key ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {tab.label} ({statusCounts[tab.key]})
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par client ou numero ticket"
              className="min-h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 outline-none focus:border-sky-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-3 md:hidden">
            {filteredOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">Ticket</p>
                    <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[order.status]}`}>
                    {order.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Client</p>
                    <p className="font-medium text-slate-800">{order.client?.fullName ?? "Client comptoir"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Rendu</p>
                    <p className="font-medium text-slate-800">
                      {new Date(order.dueDate).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="font-semibold text-slate-900">{formatXof(order.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Caissier / Admin</p>
                    <p className="font-medium text-slate-800">{order.cashierId || "Utilisateur connecté"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{order.orderNumber}</DialogTitle>
                        <DialogDescription>
                          Paiement: {order.paymentMethod} - Statut: {order.status}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                            <p className="font-semibold">
                              {item.productName} x{item.quantity}
                            </p>
                            <p className="text-xs text-slate-500">{item.optionLabel}</p>
                            <p className="text-sm font-semibold">{formatXof(item.lineTotal)}</p>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  {nextLabel[order.status] ? (
                    <Button size="sm" onClick={() => handleAdvanceStatus(order.id)} disabled={isPending}>
                      {nextLabel[order.status]}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled>
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Finalisee
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Aucune commande ne correspond aux filtres.
              </p>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Rendu</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Caissier / Admin</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold">{order.orderNumber}</td>
                    <td className="px-4 py-3">{order.client?.fullName ?? "Client comptoir"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(order.dueDate).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatXof(order.total)}</td>
                    <td className="px-4 py-3">{order.cashierId || "Utilisateur connecté"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{order.orderNumber}</DialogTitle>
                              <DialogDescription>
                                Paiement: {order.paymentMethod} - Statut: {order.status}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              {order.items.map((item) => (
                                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                                  <p className="font-semibold">
                                    {item.productName} x{item.quantity}
                                  </p>
                                  <p className="text-xs text-slate-500">{item.optionLabel}</p>
                                  <p className="text-sm font-semibold">{formatXof(item.lineTotal)}</p>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                        {nextLabel[order.status] ? (
                          <Button
                            size="sm"
                            onClick={() => handleAdvanceStatus(order.id)}
                            disabled={isPending}
                          >
                            {nextLabel[order.status]}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Finalisee
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                      Aucune commande ne correspond aux filtres.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dernières commandes</CardTitle>
            <CardDescription>Liste des commandes récentes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
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
                {orders.slice(0, 10).map((order) => (
                  <tr key={`recent-${order.id}`} className="text-sm text-slate-700">
                    <td className="border-b border-slate-200 px-4 py-4 font-semibold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4">{order.client?.fullName ?? "Client comptoir"}</td>
                    <td className="border-b border-slate-200 px-4 py-4">
                      {new Date(order.createdAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4">
                      {new Date(order.dueDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4 text-right font-semibold">
                      {formatXof(order.total)}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-4 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      Aucune commande enregistrée.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Etat d&apos;avancement des commandes</CardTitle>
            <CardDescription>Vue globale des commandes par etape.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                name: "Receptions",
                value: orders.filter((entry) => entry.status === "RECU").length,
                fill: "#f59e0b",
              },
              {
                name: "En cours de lavage",
                value: orders.filter((entry) => entry.status === "EN_COURS").length,
                fill: "#38bdf8",
              },
              {
                name: "Repassage",
                value: orders.filter((entry) => entry.status === "TERMINE").length,
                fill: "#1e3a8a",
              },
              {
                name: "Pret pour retrait",
                value: orders.filter((entry) => entry.status === "LIVRE").length,
                fill: "#ec4899",
              },
            ].map((item) => {
              const max = Math.max(1, orders.length);
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
