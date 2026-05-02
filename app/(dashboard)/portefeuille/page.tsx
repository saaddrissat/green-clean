 "use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

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

type Supplier = {
  id: string;
  name: string;
  phone: string;
  category: string;
};

const WEEK_DAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

const formatDh = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} DHs`;

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

const initialTransactions: WalletTransaction[] = [
  { id: "TX-001", date: "2026-04-26T08:45:00", client: "Awa Ndiaye", amount: 1200, method: "TPE" },
  { id: "TX-002", date: "2026-04-27T10:10:00", client: "Moussa Diallo", amount: 850, method: "Cash" },
  { id: "TX-003", date: "2026-04-29T12:30:00", client: "Fatou Sarr", amount: 1600, method: "Crédit" },
  { id: "TX-004", date: "2026-05-01T14:05:00", client: "Ibrahima Fall", amount: 980, method: "TPE" },
  { id: "TX-005", date: "2026-05-04T09:20:00", client: "Nora Bertrand", amount: 1420, method: "Cash" },
  { id: "TX-006", date: "2026-05-07T17:00:00", client: "Samir Girard", amount: 770, method: "TPE" },
];

const initialExpenses: Expense[] = [
  { id: "DEP-001", date: "2026-04-27T11:00:00", label: "Achat lessive", amount: 600, category: "Produit" },
  { id: "DEP-002", date: "2026-05-01T09:30:00", label: "Transport", amount: 180, category: "Divers" },
  { id: "DEP-003", date: "2026-05-05T16:10:00", label: "Maintenance machine", amount: 450, category: "Divers" },
];

const initialSuppliers: Supplier[] = [
  { id: "F-001", name: "CleanPro Maroc", phone: "06 61 23 45 67", category: "Produits lessive" },
  { id: "F-002", name: "Textile Service", phone: "06 77 88 19 32", category: "Consommables" },
];

export default function PortefeuillePage() {
  const [transactions] = useState(initialTransactions);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [suppliers, setSuppliers] = useState(initialSuppliers);

  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("Divers");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("");

  const today = useMemo(() => toDayStart(new Date()), []);
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

  const totals = useMemo(() => {
    const revenue = filteredTransactions.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    return { revenue, totalExpenses, balance: revenue - totalExpenses };
  }, [filteredTransactions, filteredExpenses]);

  const paymentSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, item) => {
        acc[item.method] += item.amount;
        return acc;
      },
      { TPE: 0, Cash: 0, Crédit: 0 } as Record<PaymentMethod, number>,
    );
  }, [filteredTransactions]);

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

  const handleAddSupplier = () => {
    if (!supplierName.trim() || !supplierPhone.trim() || !supplierCategory.trim()) return;
    const nextSupplier: Supplier = {
      id: `F-${Date.now()}`,
      name: supplierName.trim(),
      phone: supplierPhone.trim(),
      category: supplierCategory.trim(),
    };
    setSuppliers((prev) => [nextSupplier, ...prev]);
    setSupplierName("");
    setSupplierPhone("");
    setSupplierCategory("");
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
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatDh(totals.revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Dépenses</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{formatDh(totals.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Solde caisse</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatDh(totals.balance)}</p>
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
          <CardHeader>
            <CardTitle className="text-lg">Clôture de caisse</CardTitle>
            <CardDescription>Résumé de la période sélectionnée pour clôturer la caisse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span>Total des entrées</span>
              <span className="font-semibold">{formatDh(totals.revenue)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span>Total des dépenses</span>
              <span className="font-semibold">{formatDh(totals.totalExpenses)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-emerald-50 px-3 py-2">
              <span>Net à clôturer</span>
              <span className="font-semibold text-emerald-700">{formatDh(totals.balance)}</span>
            </div>
            <Button type="button" className="w-full sm:w-auto">
              Valider la clôture
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ajouter une dépense</CardTitle>
            <CardDescription>Enregistrer les sorties de caisse.</CardDescription>
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
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm first:border-t-0">
                  <span>
                    {expense.label} - {expense.category}
                  </span>
                  <span className="font-semibold">{formatDh(expense.amount)}</span>
                </div>
              ))}
              {filteredExpenses.length === 0 ? (
                <div className="border-t border-slate-200 px-3 py-3 text-sm text-slate-500">Aucune dépense sur cette période.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fournisseurs</CardTitle>
            <CardDescription>Gestion des fournisseurs et contacts.</CardDescription>
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
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="border-t border-slate-200 px-3 py-2 text-sm first:border-t-0">
                  <p className="font-semibold text-slate-900">{supplier.name}</p>
                  <p className="text-slate-600">{supplier.phone}</p>
                  <p className="text-xs text-slate-500">{supplier.category}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

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
