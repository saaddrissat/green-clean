"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import type { ProviderRow } from "@/app/actions/providers";
import {
  createProviderAction,
  createSupplierExpenseAction,
  deleteProviderAction,
  listProviderExpensesAction,
  listProvidersWithMonthlyTotalsAction,
  updateProviderAction,
} from "@/app/actions/providers";
import type { CashClosureRow } from "@/app/actions/wallet";
import {
  getCashSettingsAction,
  getWalletDailyCandlesAction,
  listWalletTransactionsAction,
  getWalletPeriodTotalsAction,
  listCashClosuresAction,
  recordCashClosureAction,
  updateCashClosureAction,
  updateCashSettingsAction,
} from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PaymentMethod = "TPE" | "Cash" | "Crédit";
type PeriodMode = "day" | "week" | "month";
type ExpenseCategory = "Loyer" | "Salaire" | "Produit" | "Divers" | "Fournisseur";

type WalletTransaction = {
  id: string;
  date: string;
  client: string;
  amount: number;
  method: PaymentMethod;
};

type Expense = {
  id: string;
  date: string;
  label: string;
  amount: number;
  category: ExpenseCategory;
};

type DailyCandle = {
  date: string;
  revenue: number;
  expense: number;
  profit: number;
};

const WEEK_DAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

/** Jours ISO 1 = lundi … 7 = dimanche. */
const ISO_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

const formatDh = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} DHs`;
const formatDhCompact = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(amount);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));

const formatDateNumeric = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

/** Lien WhatsApp (Maroc : 06… → 2126…). Retourne null si aucun num exploitable. */
function buildWhatsAppLink(phone: string, message?: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("212")) {
    // déjà indicatif MA
  } else if (n.length === 10 && n.startsWith("0")) {
    n = `212${n.slice(1)}`;
  } else if (n.length === 9 && !n.startsWith("212")) {
    n = `212${n}`;
  }
  const base = `https://wa.me/${n}`;
  if (message?.trim()) return `${base}?text=${encodeURIComponent(message.trim())}`;
  return base;
}

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

const buildMonthDays = (monthDate: Date) => {
  const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekStart = startOfWeek(firstDayOfMonth);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstWeekStart);
    day.setDate(firstWeekStart.getDate() + index);
    return day;
  });
};

const initialExpenses: Expense[] = [
  { id: "DEP-001", date: "2026-04-27T11:00:00", label: "Achat lessive", amount: 600, category: "Produit" },
  { id: "DEP-002", date: "2026-05-01T09:30:00", label: "Transport", amount: 180, category: "Divers" },
  { id: "DEP-003", date: "2026-05-05T16:10:00", label: "Maintenance machine", amount: 450, category: "Divers" },
];

export default function PortefeuillePage() {
  const today = useMemo(() => toDayStart(new Date()), []);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [suppliers, setSuppliers] = useState<ProviderRow[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [closureFeedback, setClosureFeedback] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [closurePending, setClosurePending] = useState(false);
  const [countedInput, setCountedInput] = useState("");
  const [closureComment, setClosureComment] = useState("");
  const [prismaTotals, setPrismaTotals] = useState<{ revenueTotal: number; expenseTotal: number; netToClose: number } | null>(
    null,
  );
  const [dailyCandles, setDailyCandles] = useState<DailyCandle[]>([]);
  const [closureCheck, setClosureCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [closures, setClosures] = useState<CashClosureRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cashReserve, setCashReserve] = useState(0);
  const [closureTimePref, setClosureTimePref] = useState("");
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editClosure, setEditClosure] = useState<CashClosureRow | null>(null);
  const [editCounted, setEditCounted] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);

  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("Divers");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");
  const [expenseHistoryOpen, setExpenseHistoryOpen] = useState(false);
  const [expenseTimelineOpen, setExpenseTimelineOpen] = useState(false);
  const [expenseHistoryMode, setExpenseHistoryMode] = useState<PeriodMode>("week");
  const [expenseHistoryStart, setExpenseHistoryStart] = useState(startOfWeek(today));
  const [expenseHistoryEnd, setExpenseHistoryEnd] = useState(endOfWeek(today));
  const [expenseDraftMode, setExpenseDraftMode] = useState<PeriodMode>("week");
  const [expenseDraftStart, setExpenseDraftStart] = useState<Date | null>(startOfWeek(today));
  const [expenseDraftEnd, setExpenseDraftEnd] = useState<Date | null>(endOfWeek(today));
  const [expenseVisibleMonth, setExpenseVisibleMonth] = useState(startOfMonth(today));

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("");

  const [supplierEditOpen, setSupplierEditOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ProviderRow | null>(null);
  const [supplierEditName, setSupplierEditName] = useState("");
  const [supplierEditPhone, setSupplierEditPhone] = useState("");
  const [supplierEditCategory, setSupplierEditCategory] = useState("");
  const [supplierEditExpenseTitle, setSupplierEditExpenseTitle] = useState("");
  const [supplierEditExpenseAmount, setSupplierEditExpenseAmount] = useState("");
  const [supplierSavePending, setSupplierSavePending] = useState(false);

  const [supplierHistoryOpen, setSupplierHistoryOpen] = useState(false);
  const [historyForSupplier, setHistoryForSupplier] = useState<ProviderRow | null>(null);
  const [supplierHistoryData, setSupplierHistoryData] = useState<Awaited<
    ReturnType<typeof listProviderExpensesAction>
  > | null>(null);
  const [supplierHistoryLoading, setSupplierHistoryLoading] = useState(false);
  const [supplierExpensesHistoryOpen, setSupplierExpensesHistoryOpen] = useState(false);

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const list = await listProvidersWithMonthlyTotalsAction();
      setSuppliers(list);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("week");
  const [periodStart, setPeriodStart] = useState(startOfWeek(today));
  const [periodEnd, setPeriodEnd] = useState(endOfWeek(today));

  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<PeriodMode>(periodMode);
  const [draftStart, setDraftStart] = useState<Date | null>(periodStart);
  const [draftEnd, setDraftEnd] = useState<Date | null>(periodEnd);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(periodStart));

  const rangeLabel = useMemo(() => {
    if (!periodStart || !periodEnd) return "Sélectionner une période";
    return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;
  }, [periodStart, periodEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const candles = await getWalletDailyCandlesAction(periodStart.toISOString(), periodEnd.toISOString());
        if (!cancelled) setDailyCandles(candles);
      } catch {
        if (!cancelled) setDailyCandles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodStart, periodEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const totals = await getWalletPeriodTotalsAction(periodStart.toISOString(), periodEnd.toISOString());
        if (!cancelled) setPrismaTotals(totals);
      } catch {
        if (!cancelled) setPrismaTotals(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodStart, periodEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, settings] = await Promise.all([listCashClosuresAction(), getCashSettingsAction()]);
        if (cancelled) return;
        setClosures(list);
        setCashReserve(settings.cashReserveAmount);
        setClosureTimePref(settings.cashClosureTimePref);
        setWorkDays(settings.cashWorkDays.length ? settings.cashWorkDays : [1, 2, 3, 4, 5]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listWalletTransactionsAction();
        if (!cancelled) setTransactions(rows);
      } catch {
        if (!cancelled) setTransactions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raw = countedInput.replace(",", ".").trim();
    const counted = Number(raw);
    const net = prismaTotals?.netToClose;
    if (raw === "" || net == null || !Number.isFinite(counted)) {
      setClosureCheck(null);
      return;
    }
    if (counted >= net) {
      setClosureCheck({
        ok: true,
        message:
          counted === net
            ? "Montant égal au net à clôturer — validation possible."
            : `Excédent de ${formatDh(counted - net)} par rapport au net théorique.`,
      });
    } else {
      setClosureCheck({
        ok: false,
        message: `Manque ${formatDh(net - counted)} pour atteindre le net à clôturer.`,
      });
    }
  }, [countedInput, prismaTotals]);

  const filteredTransactions = useMemo(() => {
    const start = toDayStart(periodStart).getTime();
    const end = toDayEnd(periodEnd).getTime();
    return transactions.filter((item) => {
      const date = new Date(item.date).getTime();
      return date >= start && date <= end;
    });
  }, [periodStart, periodEnd, transactions]);

  const filteredExpenses = useMemo(() => {
    const start = toDayStart(periodStart).getTime();
    const end = toDayEnd(periodEnd).getTime();
    return expenses.filter((item) => {
      const date = new Date(item.date).getTime();
      return date >= start && date <= end;
    });
  }, [periodStart, periodEnd, expenses]);

  const todaysExpenses = useMemo(() => {
    const todayStartTs = toDayStart(new Date()).getTime();
    return expenses.filter((item) => toDayStart(new Date(item.date)).getTime() === todayStartTs);
  }, [expenses]);

  const filteredExpenseHistory = useMemo(() => {
    const start = toDayStart(expenseHistoryStart).getTime();
    const end = toDayEnd(expenseHistoryEnd).getTime();
    return expenses
      .filter((item) => {
        const date = new Date(item.date).getTime();
        return date >= start && date <= end;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, expenseHistoryStart, expenseHistoryEnd]);

  const groupedExpenseHistory = useMemo(() => {
    const map = new Map<string, { label: string; rows: Expense[]; total: number }>();
    for (const row of filteredExpenseHistory) {
      const dayDate = toDayStart(new Date(row.date));
      const key = dayDate.toISOString();
      const cur = map.get(key) ?? {
        label: formatDate(dayDate),
        rows: [],
        total: 0,
      };
      cur.rows.push(row);
      cur.total += row.amount;
      map.set(key, cur);
    }
    return [...map.entries()]
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([, value]) => value);
  }, [filteredExpenseHistory]);

  const supplierExpenseHistoryRows = useMemo(() => {
    return filteredExpenseHistory
      .filter((row) => row.category === "Fournisseur")
      .map((row) => {
        const match = row.label.match(/\(([^)]+)\)\s*$/);
        return {
          id: row.id,
          date: row.date,
          amount: row.amount,
          supplierName: match?.[1]?.trim() || row.label,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredExpenseHistory]);

  const expenseHistoryRangeLabel = useMemo(() => {
    return `${formatDate(expenseHistoryStart)} - ${formatDate(expenseHistoryEnd)}`;
  }, [expenseHistoryStart, expenseHistoryEnd]);

  const totals = useMemo(() => {
    const revenue = filteredTransactions.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    return { revenue, totalExpenses, balance: revenue - totalExpenses };
  }, [filteredTransactions, filteredExpenses]);

  const revenueKpi = prismaTotals?.revenueTotal ?? totals.revenue;
  const expenseKpi = prismaTotals?.expenseTotal ?? totals.totalExpenses;
  const balanceKpi = prismaTotals?.netToClose ?? totals.balance;

  const paymentSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, item) => {
        acc[item.method] += item.amount;
        return acc;
      },
      { TPE: 0, Cash: 0, Crédit: 0 } as Record<PaymentMethod, number>,
    );
  }, [filteredTransactions]);

  const maxCandleValue = useMemo(() => {
    return Math.max(
      1,
      ...dailyCandles.map((c) => Math.max(c.revenue, c.expense, Math.abs(c.profit))),
    );
  }, [dailyCandles]);

  const yAxisStep = useMemo(() => {
    if (maxCandleValue <= 100) return 10;
    if (maxCandleValue <= 1000) return 100;
    return 1000;
  }, [maxCandleValue]);

  const yAxisMax = useMemo(() => {
    return Math.max(yAxisStep, Math.ceil(maxCandleValue / yAxisStep) * yAxisStep);
  }, [maxCandleValue, yAxisStep]);

  const yAxisTicks = useMemo(() => {
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
      ratio,
      value: Math.round(yAxisMax * ratio),
    }));
  }, [yAxisMax]);

  const handleCashClosure = async () => {
    setClosureFeedback(null);
    const counted = Number(countedInput.replace(",", "."));
    if (!Number.isFinite(counted) || counted < 0) {
      setClosureFeedback({ ok: false, message: "Entrez un montant compté valide." });
      return;
    }
    setClosurePending(true);
    try {
      await recordCashClosureAction({
        countedAmount: counted,
        comment: closureComment.trim() || undefined,
        periodStartIso: periodStart.toISOString(),
        periodEndIso: periodEnd.toISOString(),
      });
      const net = prismaTotals?.netToClose ?? 0;
      if (counted >= net) {
        setClosureFeedback({
          ok: true,
          message:
            counted === net
              ? "Clôture enregistrée : montant conforme au net à clôturer."
              : `Clôture enregistrée : excédent de ${formatDh(counted - net)}.`,
        });
      } else {
        setClosureFeedback({
          ok: false,
          message: `Clôture enregistrée avec écart : il manque ${formatDh(net - counted)} par rapport au net théorique.`,
        });
      }
      setCountedInput("");
      setClosureComment("");
      setClosureCheck(null);
      const list = await listCashClosuresAction();
      setClosures(list);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("gc-notifications-updated"));
      }
    } catch (e) {
      setClosureFeedback({
        ok: false,
        message: e instanceof Error ? e.message : "Impossible d'enregistrer la clôture.",
      });
    } finally {
      setClosurePending(false);
    }
  };

  const handleSaveCashSettings = async () => {
    setSettingsPending(true);
    try {
      await updateCashSettingsAction({
        cashReserveAmount: cashReserve,
        cashClosureTimePref: closureTimePref || null,
        cashWorkDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
      });
      setSettingsOpen(false);
    } catch (e) {
      setClosureFeedback({
        ok: false,
        message: e instanceof Error ? e.message : "Impossible d'enregistrer les paramètres.",
      });
    } finally {
      setSettingsPending(false);
    }
  };

  const handleSaveEditClosure = async () => {
    if (!editClosure) return;
    const n = Number(editCounted.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    setEditPending(true);
    try {
      await updateCashClosureAction({
        id: editClosure.id,
        countedAmount: n,
        comment: editComment,
      });
      setEditClosure(null);
      const list = await listCashClosuresAction();
      setClosures(list);
    } catch (e) {
      setClosureFeedback({
        ok: false,
        message: e instanceof Error ? e.message : "Impossible de modifier la clôture.",
      });
    } finally {
      setEditPending(false);
    }
  };

  const toggleWorkDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const openDateDialog = () => {
    setDraftMode(periodMode);
    setDraftStart(periodStart);
    setDraftEnd(periodEnd);
    setVisibleMonth(startOfMonth(periodStart));
    setIsDateDialogOpen(true);
  };

  const applyPreset = (mode: PeriodMode) => {
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
    setPeriodMode(draftMode);
    setPeriodStart(toDayStart(draftStart));
    setPeriodEnd(toDayStart(nextEnd));
    setIsDateDialogOpen(false);
  };

  const applyExpensePreset = (mode: PeriodMode) => {
    const now = toDayStart(new Date());
    setExpenseDraftMode(mode);
    if (mode === "day") {
      setExpenseDraftStart(now);
      setExpenseDraftEnd(now);
      setExpenseVisibleMonth(startOfMonth(now));
      return;
    }
    if (mode === "week") {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      setExpenseDraftStart(start);
      setExpenseDraftEnd(end);
      setExpenseVisibleMonth(startOfMonth(start));
      return;
    }
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    setExpenseDraftStart(start);
    setExpenseDraftEnd(end);
    setExpenseVisibleMonth(startOfMonth(start));
  };

  const handleExpenseDayClick = (date: Date) => {
    const clicked = toDayStart(date);
    if (expenseDraftMode === "day") {
      setExpenseDraftStart(clicked);
      setExpenseDraftEnd(clicked);
      return;
    }
    if (!expenseDraftStart || (expenseDraftStart && expenseDraftEnd)) {
      setExpenseDraftStart(clicked);
      setExpenseDraftEnd(null);
      return;
    }
    if (clicked.getTime() < expenseDraftStart.getTime()) {
      setExpenseDraftEnd(expenseDraftStart);
      setExpenseDraftStart(clicked);
      return;
    }
    setExpenseDraftEnd(clicked);
  };

  const saveExpenseTimeline = () => {
    if (!expenseDraftStart) return;
    const nextEnd = expenseDraftEnd ?? expenseDraftStart;
    setExpenseHistoryMode(expenseDraftMode);
    setExpenseHistoryStart(toDayStart(expenseDraftStart));
    setExpenseHistoryEnd(toDayStart(nextEnd));
    setExpenseTimelineOpen(false);
  };

  const monthTitle = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);

  const leftMonthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const rightMonth = useMemo(
    () => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
    [visibleMonth],
  );
  const rightMonthDays = useMemo(() => buildMonthDays(rightMonth), [rightMonth]);

  const inDraftRange = (day: Date) => {
    if (!draftStart) return false;
    const start = toDayStart(draftStart).getTime();
    const end = toDayStart(draftEnd ?? draftStart).getTime();
    const current = toDayStart(day).getTime();
    return current >= Math.min(start, end) && current <= Math.max(start, end);
  };

  const isRangeEdge = (day: Date) =>
    (draftStart && isSameDay(day, draftStart)) || (draftEnd && isSameDay(day, draftEnd));

  const handleAddExpense = () => {
    const parsedAmount = Number(expenseAmount);
    if (!expenseLabel.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    if (expenseCategory === "Fournisseur" && !expenseSupplierId) return;
    const selectedSupplier = suppliers.find((supplier) => supplier.id === expenseSupplierId);
    const expenseLabelWithSupplier =
      expenseCategory === "Fournisseur" && selectedSupplier
        ? `${expenseLabel.trim()} (${selectedSupplier.name})`
        : expenseLabel.trim();

    const persist = async () => {
      if (expenseCategory === "Fournisseur" && expenseSupplierId) {
        try {
          await createSupplierExpenseAction({
            providerId: expenseSupplierId,
            title: expenseLabelWithSupplier,
            amount: parsedAmount,
          });
          await loadProviders();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Impossible d’enregistrer la dépense fournisseur.");
          return;
        }
      }
      const nextExpense: Expense = {
        id: `DEP-${Date.now()}`,
        date: new Date().toISOString(),
        label: expenseLabelWithSupplier,
        amount: parsedAmount,
        category: expenseCategory,
      };
      setExpenses((prev) => [nextExpense, ...prev]);
      setExpenseLabel("");
      setExpenseAmount("");
      setExpenseCategory("Divers");
      setExpenseSupplierId("");
    };
    void persist();
  };

  const handleAddSupplier = () => {
    if (!supplierName.trim() || !supplierPhone.trim() || !supplierCategory.trim()) return;
    const run = async () => {
      try {
        await createProviderAction({
          name: supplierName.trim(),
          phone: supplierPhone.trim(),
          category: supplierCategory.trim(),
        });
        await loadProviders();
        setSupplierName("");
        setSupplierPhone("");
        setSupplierCategory("");
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Impossible d’ajouter le fournisseur.");
      }
    };
    void run();
  };

  const openSupplierHistory = async (supplier: ProviderRow) => {
    setHistoryForSupplier(supplier);
    setSupplierHistoryOpen(true);
    setSupplierHistoryLoading(true);
    setSupplierHistoryData(null);
    try {
      const data = await listProviderExpensesAction(supplier.id);
      setSupplierHistoryData(data);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Impossible de charger l’historique.");
    } finally {
      setSupplierHistoryLoading(false);
    }
  };

  const handleDeleteSupplier = (supplier: ProviderRow) => {
    if (!window.confirm(`Supprimer le fournisseur « ${supplier.name} » ?`)) return;
    const run = async () => {
      try {
        await deleteProviderAction(supplier.id);
        if (expenseSupplierId === supplier.id) setExpenseSupplierId("");
        await loadProviders();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Suppression impossible.");
      }
    };
    void run();
  };

  const handleSaveSupplierEdit = () => {
    if (!editingSupplier) return;
    const run = async () => {
      setSupplierSavePending(true);
      try {
        await updateProviderAction({
          id: editingSupplier.id,
          name: supplierEditName,
          phone: supplierEditPhone || null,
          category: supplierEditCategory || null,
        });
        const extra = Number(supplierEditExpenseAmount);
        if (Number.isFinite(extra) && extra > 0) {
          await createSupplierExpenseAction({
            providerId: editingSupplier.id,
            title: supplierEditExpenseTitle.trim() || `Dépense ${supplierEditName.trim()}`,
            amount: extra,
          });
        }
        await loadProviders();
        setSupplierEditOpen(false);
        setEditingSupplier(null);
        setSupplierEditExpenseTitle("");
        setSupplierEditExpenseAmount("");
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Enregistrement impossible.");
      } finally {
        setSupplierSavePending(false);
      }
    };
    void run();
  };

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

  const expenseLeftMonthDays = useMemo(() => buildMonthDays(expenseVisibleMonth), [expenseVisibleMonth]);

  const inExpenseDraftRange = (day: Date) => {
    if (!expenseDraftStart) return false;
    const start = toDayStart(expenseDraftStart).getTime();
    const end = toDayStart(expenseDraftEnd ?? expenseDraftStart).getTime();
    const current = toDayStart(day).getTime();
    return current >= Math.min(start, end) && current <= Math.max(start, end);
  };

  const isExpenseRangeEdge = (day: Date) =>
    (expenseDraftStart && isSameDay(day, expenseDraftStart)) || (expenseDraftEnd && isSameDay(day, expenseDraftEnd));

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Portefeuille</h1>
            <p className="mt-1 text-sm text-slate-500">
              Suivi des transactions, paiements, dépenses, clôture de caisse et fournisseurs.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={openDateDialog}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {rangeLabel}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Entrées caisse</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatDh(revenueKpi)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Dépenses</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{formatDh(expenseKpi)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Solde caisse</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatDh(balanceKpi)}</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg">Détails des transactions</CardTitle>
              <CardDescription>
                {`La période afficher est : ${formatDateNumeric(periodStart)} -> ${formatDateNumeric(periodEnd)}`}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={openDateDialog} aria-label="Ouvrir la timeline">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {dailyCandles.length === 0 ? (
              <div className="rounded-xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Aucune donnée journalière sur cette période.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200 p-3">
                  <div className="flex min-h-[260px] gap-2">
                    <div className="relative h-52 w-14 shrink-0">
                      <div className="absolute -top-5 right-0 text-[10px] font-medium text-slate-600">Montant (Dh)</div>
                      {yAxisTicks.map((tick) => (
                        <div
                          key={`tick-${tick.ratio}`}
                          className="absolute left-0 right-0"
                          style={{ bottom: `${tick.ratio * 100}%` }}
                        >
                          <div className="absolute right-0 -translate-y-1/2 pr-2 text-[10px] text-slate-500">
                            {formatDhCompact(tick.value)}
                          </div>
                          <div className="ml-12 border-t border-dashed border-slate-200" />
                        </div>
                      ))}
                    </div>
                    <div className="flex min-h-[260px] items-end gap-2">
                      {dailyCandles.map((candle) => {
                        const dayLabel = new Intl.DateTimeFormat("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        }).format(new Date(candle.date));
                        const revenuePct = (Math.max(0, candle.revenue) / yAxisMax) * 100;
                        const barWidth = dailyCandles.length <= 7 ? 44 : dailyCandles.length <= 14 ? 30 : 20;
                        const expenseInsidePct =
                          candle.revenue > 0 ? Math.min(100, (Math.max(0, candle.expense) / candle.revenue) * 100) : 0;
                        const profitInsidePct = Math.max(0, 100 - expenseInsidePct);
                        return (
                          <div key={candle.date} className="flex flex-col items-center" style={{ width: `${barWidth}px` }}>
                            <div className="relative flex h-52 w-full items-end justify-center rounded-md bg-slate-50">
                              <div
                                className="relative w-[70%] overflow-hidden rounded-sm border border-slate-300 bg-slate-200"
                                style={{ height: `${Math.max(2, revenuePct)}%` }}
                                title={`CA: ${formatDh(candle.revenue)} | Dépenses: ${formatDh(candle.expense)} | Bénéfice: ${formatDh(candle.profit)}`}
                              >
                                <div
                                  className="absolute bottom-0 left-0 w-full bg-rose-400"
                                  style={{ height: `${expenseInsidePct}%` }}
                                  title={`Dépenses: ${formatDh(candle.expense)}`}
                                />
                                <div
                                  className="absolute left-0 top-0 w-full bg-emerald-500"
                                  style={{ height: `${profitInsidePct}%` }}
                                  title={`Bénéfice: ${formatDh(candle.profit)}`}
                                />
                              </div>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-600">{dayLabel}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-slate-200" />
                    CA (hauteur totale)
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
                    Dépenses (bas de la bougie)
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Bénéfice (haut de la bougie)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transactions</CardTitle>
            <CardDescription>Historique des transactions et des paiements clients.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Montant</th>
                  <th className="px-4 py-3 font-semibold">Moyen de paiement</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-slate-900">{tx.id}</td>
                    <td className="px-4 py-3">{formatDateTime(tx.date)}</td>
                    <td className="px-4 py-3">{tx.client}</td>
                    <td className="px-4 py-3 font-semibold">{formatDh(tx.amount)}</td>
                    <td className="px-4 py-3">{tx.method}</td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                      Aucune transaction sur cette période.
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
            <CardTitle className="text-lg">Moyens de paiement</CardTitle>
            <CardDescription>Répartition des paiements par méthode.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">TPE</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatDh(paymentSummary.TPE)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Cash</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatDh(paymentSummary.Cash)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Crédit</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatDh(paymentSummary.Crédit)}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-lg">Clôture de caisse</CardTitle>
              <CardDescription>Résumé de la période sélectionnée pour clôturer la caisse.</CardDescription>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1 self-end sm:self-start">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full"
                title="Historique des clôtures"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full"
                title="Paramètres caisse (fonds, heure, jours)"
                onClick={() => setSettingsOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span>Total des entrées (base)</span>
              <span className="font-semibold">{formatDh(revenueKpi)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span>Total des dépenses (base)</span>
              <span className="font-semibold">{formatDh(expenseKpi)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-emerald-50 px-3 py-2">
              <span>Net à clôturer</span>
              <span className="font-semibold text-emerald-700">{formatDh(balanceKpi)}</span>
            </div>
            {cashReserve > 0 ? (
              <p className="text-xs text-slate-600">
                Fonds de caisse cible (réserve) : <span className="font-semibold">{formatDh(cashReserve)}</span>
              </p>
            ) : null}
            <div className="space-y-1.5">
              <label htmlFor="counted-cash" className="text-xs font-semibold text-slate-600">
                Montant compté en caisse (DHs)
              </label>
              <input
                id="counted-cash"
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                value={countedInput}
                onChange={(e) => setCountedInput(e.target.value)}
                placeholder="0"
                className="w-full min-h-11 rounded-lg border border-slate-300 px-3 tabular-nums"
              />
            </div>
            {closureCheck?.message ? (
              <p className={`rounded-lg px-3 py-2 text-sm font-medium ${closureCheck.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                {closureCheck.message}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <label htmlFor="closure-comment" className="text-xs font-semibold text-slate-600">
                Commentaire (optionnel)
              </label>
              <textarea
                id="closure-comment"
                rows={2}
                value={closureComment}
                onChange={(e) => setClosureComment(e.target.value)}
                placeholder="Notes pour cette clôture…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              La clôture enregistre les totaux réels de la période sélectionnée (commandes et dépenses) ainsi que le montant compté.
            </p>
            {closureFeedback?.message ? (
              <p className={`text-sm font-medium ${closureFeedback.ok ? "text-emerald-700" : "text-red-600"}`}>
                {closureFeedback.message}
              </p>
            ) : null}
            <Button type="button" className="w-full sm:w-auto" disabled={closurePending} onClick={() => void handleCashClosure()}>
              {closurePending ? "Enregistrement..." : "Valider la clôture"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-lg">Ajouter une dépense</CardTitle>
              <CardDescription>Enregistrer les sorties de caisse.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpenseHistoryOpen(true)}>
              <History className="h-4 w-4" />
              Historique
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Libellé de la dépense"
              value={expenseLabel}
              onChange={(event) => setExpenseLabel(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="number"
              min="0"
              placeholder="Montant"
              value={expenseAmount}
              onChange={(event) => setExpenseAmount(event.target.value)}
            />
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={expenseCategory}
              onChange={(event) => {
                const value = event.target.value as ExpenseCategory;
                setExpenseCategory(value);
                if (value !== "Fournisseur") {
                  setExpenseSupplierId("");
                }
              }}
            >
              <option value="Loyer">Loyer</option>
              <option value="Salaire">Salaire</option>
              <option value="Produit">Produit</option>
              <option value="Divers">Divers</option>
              <option value="Fournisseur">Fournisseur</option>
            </select>
            {expenseCategory === "Fournisseur" ? (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={expenseSupplierId}
                onChange={(event) => setExpenseSupplierId(event.target.value)}
              >
                <option value="">Choisir un fournisseur</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="button" onClick={handleAddExpense}>
              Ajouter la dépense
            </Button>
            <div className="rounded-xl border border-slate-200">
              {todaysExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm first:border-t-0">
                  <span>
                    {expense.label} - {expense.category}
                  </span>
                  <span className="font-semibold">{formatDh(expense.amount)}</span>
                </div>
              ))}
              {todaysExpenses.length === 0 ? (
                <div className="border-t border-slate-200 px-3 py-3 text-sm text-slate-500">Aucune dépense aujourd'hui.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg">Fournisseurs</CardTitle>
              <CardDescription>Gestion des fournisseurs et contacts.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setSupplierExpensesHistoryOpen(true)}>
              <History className="h-3.5 w-3.5" />
              Historique
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nom du fournisseur"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Téléphone"
              value={supplierPhone}
              onChange={(event) => setSupplierPhone(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Catégorie (produits, maintenance, etc.)"
              value={supplierCategory}
              onChange={(event) => setSupplierCategory(event.target.value)}
            />
            <Button type="button" onClick={handleAddSupplier}>
              Ajouter le fournisseur
            </Button>
            <div className="rounded-xl border border-slate-200">
              {providersLoading ? (
                <div className="border-t border-slate-200 px-3 py-4 text-sm text-slate-500 first:border-t-0">Chargement…</div>
              ) : suppliers.length === 0 ? (
                <div className="border-t border-slate-200 px-3 py-4 text-sm text-slate-500 first:border-t-0">
                  Aucun fournisseur. Ajoutez-en un ci-dessus.
                </div>
              ) : (
                suppliers.map((supplier) => {
                  const wa = buildWhatsAppLink(supplier.phone, `Bonjour ${supplier.name}, `);
                  return (
                    <div key={supplier.id} className="border-t border-slate-200 px-3 py-2 text-sm first:border-t-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-semibold text-slate-900">{supplier.name}</p>
                          <p className="text-slate-600">{supplier.phone || "—"}</p>
                          <p className="text-xs text-slate-500">{supplier.category ?? "—"}</p>
                          <p className="text-xs font-semibold text-emerald-800">
                            Dépenses ce mois : {formatDh(supplier.monthlyExpenseTotal)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                          {wa ? (
                            <Button type="button" size="sm" variant="outline" className="gap-1" asChild>
                              <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                                <Send className="h-3.5 w-3.5" />
                                Envoyer
                              </a>
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="outline" disabled className="gap-1" title="Numéro manquant">
                              <Send className="h-3.5 w-3.5" />
                              Envoyer
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setSupplierEditName(supplier.name);
                              setSupplierEditPhone(supplier.phone ?? "");
                              setSupplierEditCategory(supplier.category ?? "");
                              setSupplierEditExpenseTitle("");
                              setSupplierEditExpenseAmount("");
                              setSupplierEditOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1 text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={() => handleDeleteSupplier(supplier)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => void openSupplierHistory(supplier)}
                          >
                            <History className="h-3.5 w-3.5" />
                            Historique
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={expenseHistoryOpen} onOpenChange={setExpenseHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>Historique des dépenses</DialogTitle>
                <DialogDescription>Période: {expenseHistoryRangeLabel}</DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setExpenseDraftMode(expenseHistoryMode);
                  setExpenseDraftStart(expenseHistoryStart);
                  setExpenseDraftEnd(expenseHistoryEnd);
                  setExpenseVisibleMonth(startOfMonth(expenseHistoryStart));
                  setExpenseTimelineOpen(true);
                }}
              >
                Timeline
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            {groupedExpenseHistory.length === 0 ? (
              <p className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Aucune dépense dans cette période.
              </p>
            ) : (
              groupedExpenseHistory.map((group) => (
                <div key={group.label} className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                    <p className="text-sm font-semibold text-slate-900">{formatDh(group.total)}</p>
                  </div>
                  {group.rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm first:border-t-0">
                      <span className="text-slate-700">
                        {row.label} - {row.category}
                      </span>
                      <span className="font-semibold text-slate-900">{formatDh(row.amount)}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseTimelineOpen} onOpenChange={setExpenseTimelineOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Timeline des dépenses</DialogTitle>
            <DialogDescription>Choisissez Jour, Semaine ou Mois puis sélectionnez la période.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              {[
                { label: "Jour", value: "day" as PeriodMode },
                { label: "Semaine", value: "week" as PeriodMode },
                { label: "Mois", value: "month" as PeriodMode },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => applyExpensePreset(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    expenseDraftMode === option.value ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-200"
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
                onClick={() => setExpenseVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm text-slate-600">
                {expenseDraftStart ? formatDate(expenseDraftStart) : "Début"} - {expenseDraftEnd ? formatDate(expenseDraftEnd) : "Fin"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExpenseVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-3 text-center text-sm font-semibold capitalize text-slate-900">{monthTitle(expenseVisibleMonth)}</p>
              <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
                {WEEK_DAYS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {expenseLeftMonthDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === expenseVisibleMonth.getMonth();
                  const isSelected = inExpenseDraftRange(day);
                  const isEdge = isExpenseRangeEdge(day);
                  return (
                    <button
                      key={`expense-${day.toISOString()}`}
                      type="button"
                      onClick={() => handleExpenseDayClick(day)}
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExpenseTimelineOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={saveExpenseTimeline}>
                Appliquer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={supplierEditOpen}
        onOpenChange={(open) => {
          setSupplierEditOpen(open);
          if (!open) setEditingSupplier(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le fournisseur</DialogTitle>
            <DialogDescription>Coordonnées, catégorie et optionnellement une nouvelle dépense liée.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor="edit-supplier-name">
                Nom
              </label>
              <input
                id="edit-supplier-name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={supplierEditName}
                onChange={(e) => setSupplierEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor="edit-supplier-phone">
                Téléphone
              </label>
              <input
                id="edit-supplier-phone"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={supplierEditPhone}
                onChange={(e) => setSupplierEditPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor="edit-supplier-category">
                Catégorie
              </label>
              <input
                id="edit-supplier-category"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ex. Produits lessive"
                value={supplierEditCategory}
                onChange={(e) => setSupplierEditCategory(e.target.value)}
              />
            </div>
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Nouvelle dépense (optionnel)</p>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Libellé"
                value={supplierEditExpenseTitle}
                onChange={(e) => setSupplierEditExpenseTitle(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="0"
                step={0.01}
                placeholder="Montant (DH)"
                value={supplierEditExpenseAmount}
                onChange={(e) => setSupplierEditExpenseAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSupplierEditOpen(false);
                  setEditingSupplier(null);
                }}
              >
                Annuler
              </Button>
              <Button type="button" disabled={supplierSavePending} onClick={() => void handleSaveSupplierEdit()}>
                {supplierSavePending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={supplierHistoryOpen}
        onOpenChange={(open) => {
          setSupplierHistoryOpen(open);
          if (!open) {
            setHistoryForSupplier(null);
            setSupplierHistoryData(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Dépenses — {historyForSupplier?.name ?? "Fournisseur"}
            </DialogTitle>
            <DialogDescription>
              {supplierHistoryData ? (
                <>
                  Total du mois en cours ({supplierHistoryData.monthLabel}) :{" "}
                  <span className="font-semibold text-emerald-800">{formatDh(supplierHistoryData.monthTotal)}</span>
                </>
              ) : (
                "Historique des dépenses enregistrées pour ce fournisseur."
              )}
            </DialogDescription>
          </DialogHeader>
          {supplierHistoryLoading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : supplierHistoryData && supplierHistoryData.expenses.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Libellé</th>
                    <th className="px-3 py-2 font-semibold text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierHistoryData.expenses.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.expenseDate)}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{row.title}</span>
                        {row.notes ? <p className="text-xs text-slate-500">{row.notes}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatDh(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucune dépense enregistrée pour ce fournisseur.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={supplierExpensesHistoryOpen} onOpenChange={setSupplierExpensesHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historique des dépenses fournisseurs</DialogTitle>
            <DialogDescription>Date, montant et nom du fournisseur.</DialogDescription>
          </DialogHeader>
          {supplierExpenseHistoryRows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              Aucune dépense fournisseur dans la période sélectionnée.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Fournisseur</th>
                    <th className="px-3 py-2 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierExpenseHistoryRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">{formatDateTime(row.date)}</td>
                      <td className="px-3 py-2 text-slate-900">{row.supplierName}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatDh(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historique des clôtures</DialogTitle>
            <DialogDescription>Montants enregistrés, écarts et commentaires.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Période / enregistrement</th>
                  <th className="px-3 py-2 font-semibold">Compté</th>
                  <th className="px-3 py-2 font-semibold">Net attendu</th>
                  <th className="px-3 py-2 font-semibold">Écart</th>
                  <th className="px-3 py-2 font-semibold">Commentaire</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {closures.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-slate-900">{formatDate(new Date(row.closureDate))}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(row.closedAt)}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.countedAmount != null ? formatDh(row.countedAmount) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDh(row.expectedNet)}</td>
                    <td className={`px-3 py-2 tabular-nums ${row.difference >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {formatDh(row.difference)}
                    </td>
                    <td className="max-w-[180px] px-3 py-2 text-xs text-slate-600">{row.comment ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setEditClosure(row);
                          setEditCounted(row.countedAmount != null ? String(row.countedAmount) : "");
                          setEditComment(row.comment ?? "");
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                    </td>
                  </tr>
                ))}
                {closures.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                      Aucune clôture enregistrée.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Paramètres caisse</DialogTitle>
            <DialogDescription>Fonds de réserve, heure cible de clôture et jours ouvrés.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Montant à maintenir en caisse (réserve, DHs)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={cashReserve || ""}
                onChange={(e) => setCashReserve(Number(e.target.value) || 0)}
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
              />
              <p className="text-xs text-slate-500">Somme laissée en caisse (caisse de départ / monnaie).</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Heure de clôture cible</label>
              <input
                type="time"
                value={closureTimePref}
                onChange={(e) => setClosureTimePref(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Jours de travail</p>
              <div className="flex flex-wrap gap-2">
                {ISO_WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleWorkDay(d.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      workDays.includes(d.value)
                        ? "border-sky-500 bg-sky-100 text-sky-900"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Annuler
              </Button>
              <Button type="button" disabled={settingsPending} onClick={() => void handleSaveCashSettings()}>
                {settingsPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClosure} onOpenChange={(open) => !open && setEditClosure(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la clôture</DialogTitle>
            <DialogDescription>
              {editClosure ? `${formatDate(new Date(editClosure.closureDate))} — ${formatDateTime(editClosure.closedAt)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {editClosure ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p>
                  Net attendu : <span className="font-semibold">{formatDh(editClosure.expectedNet)}</span>
                </p>
                <p className="text-xs text-slate-500">Écart actuel : {formatDh(editClosure.difference)}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Montant compté (DHs)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editCounted}
                  onChange={(e) => setEditCounted(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Commentaire</label>
                <textarea
                  rows={3}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditClosure(null)}>
                  Annuler
                </Button>
                <Button type="button" disabled={editPending} onClick={() => void handleSaveEditClosure()}>
                  {editPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Période de caisse</DialogTitle>
            <DialogDescription>
              Choisissez Jour, Semaine ou Mois puis sélectionnez une période sur le calendrier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              {[
                { label: "Jour", value: "day" as PeriodMode },
                { label: "Semaine", value: "week" as PeriodMode },
                { label: "Mois", value: "month" as PeriodMode },
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
              <Button type="button" variant="outline" onClick={() => setIsDateDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={saveSelectedPeriod}>
                Appliquer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
