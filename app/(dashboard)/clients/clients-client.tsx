"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, SendHorizontal, Trash2 } from "lucide-react";

import {
  createClientAction,
  deleteClientAction,
  getClientBalancesAction,
  getClientDetailsAction,
  getRecentClientOrdersAction,
  sendClientInvoiceAction,
} from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ClientRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  totalOrders: number;
};

type ClientsClientProps = {
  initialClients: ClientRow[];
};

type ClientDetails = Awaited<ReturnType<typeof getClientDetailsAction>>;
type RecentClientOrders = Awaited<ReturnType<typeof getRecentClientOrdersAction>>;
type ClientBalances = Awaited<ReturnType<typeof getClientBalancesAction>>;

const statusLabels: Record<string, string> = {
  RECU: "Recu",
  EN_COURS: "En cours",
  TERMINE: "Termine",
  LIVRE: "Livre",
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Cash",
  CARD: "Carte",
  MOBILE_MONEY: "Mobile money",
};

export function ClientsClient({ initialClients }: ClientsClientProps) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
  const [selectedClientDetails, setSelectedClientDetails] = useState<ClientDetails | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentClientOrders>([]);
  const [balancesByClient, setBalancesByClient] = useState<Record<string, number>>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [recent, balances] = await Promise.all([
          getRecentClientOrdersAction(),
          getClientBalancesAction(),
        ]);
        setRecentOrders(recent);
        setBalancesByClient(
          balances.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.clientId] = entry.balanceDue;
            return acc;
          }, {}),
        );
      } catch {
        // Keep page usable if these widgets fail.
      }
    };
    void loadDashboardData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (client) =>
        client.fullName.toLowerCase().includes(q) ||
        client.phone?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q),
    );
  }, [clients, query]);

  const handleAddClient = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const created = await createClientAction({ fullName, phone, email });
      setClients((prev) => [created, ...prev]);
      setFullName("");
      setPhone("");
      setEmail("");
      setMessage("Client ajouté avec succès.");
      setIsAddClientOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur ajout client.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenClientDetails = async (client: ClientRow) => {
    setIsHistoryLoading(true);
    setMessage("");
    setIsClientDetailsOpen(true);
    try {
      const details = await getClientDetailsAction(client.id);
      setSelectedClientDetails(details);
    } catch (error) {
      setSelectedClientDetails(null);
      setMessage(error instanceof Error ? error.message : "Erreur chargement historique.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Recherche et ajout rapide de clients.</CardDescription>
          </div>
          <Button onClick={() => setIsAddClientOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter client
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un client..."
              className="min-h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3"
            />
          </div>

          {message ? (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[780px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-sm text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Nom</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Téléphone</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Email</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Total commandes</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Crédit / Solde</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="text-sm text-slate-700 transition hover:bg-slate-50">
                  <td className="border-b border-slate-200 px-4 py-4 font-semibold text-slate-900">
                    <button
                      type="button"
                      className="text-left text-slate-900 hover:underline"
                      onClick={() => handleOpenClientDetails(client)}
                    >
                      {client.fullName}
                    </button>
                  </td>
                  <td className="border-b border-slate-200 px-4 py-4">{client.phone ?? "-"}</td>
                  <td className="border-b border-slate-200 px-4 py-4">{client.email ?? "-"}</td>
                  <td className="border-b border-slate-200 px-4 py-4 text-right font-semibold">
                    {client.totalOrders}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-4 text-right">
                    {balancesByClient[client.id] > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Crédit:{" "}
                        {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
                          balancesByClient[client.id],
                        )}{" "}
                        DHs
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        Solde OK
                      </span>
                    )}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async (event) => {
                          setMessage("");
                          try {
                            const sent = await sendClientInvoiceAction(client.id);
                            setMessage(
                              `Facture envoyée à ${sent.recipient} (${sent.orderNumber}) avec succès.`,
                            );
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Erreur envoi facture.");
                          }
                        }}
                      >
                        <SendHorizontal className="mr-1.5 h-4 w-4" />
                        Envoyer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={async (event) => {
                          setMessage("");
                          try {
                            await deleteClientAction(client.id);
                            setClients((prev) => prev.filter((entry) => entry.id !== client.id));
                            if (selectedClientDetails?.client.id === client.id) {
                              setSelectedClientDetails(null);
                              setIsClientDetailsOpen(false);
                            }
                            setMessage("Client supprimé avec succès.");
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Erreur suppression client.");
                          }
                        }}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Supprimer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dernières commandes clients</CardTitle>
          <CardDescription>Affiche les commandes les plus récentes enregistrées.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentOrders.length > 0 ? (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {order.orderNumber} - {order.client?.fullName ?? "Client inconnu"}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(order.total)} DHs
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Aucune commande client récente.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter client</DialogTitle>
            <DialogDescription>Renseignez les informations du client.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nom complet"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Téléphone"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleAddClient} disabled={isSaving || !fullName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {isSaving ? "Ajout..." : "Ajouter client"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientDetailsOpen} onOpenChange={setIsClientDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails client</DialogTitle>
            <DialogDescription>
              {selectedClientDetails?.client.fullName ?? "Chargement des informations client..."}
            </DialogDescription>
          </DialogHeader>
          {isHistoryLoading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : selectedClientDetails ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Téléphone:</span> {selectedClientDetails.client.phone ?? "-"}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Email:</span> {selectedClientDetails.client.email ?? "-"}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Total commandes:</span> {selectedClientDetails.client.totalOrders}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Crédit / Solde:</span>{" "}
                  {selectedClientDetails.client.balanceDue > 0
                    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
                        selectedClientDetails.client.balanceDue,
                      )} DHs à payer`
                    : "Solde OK"}
                </p>
              </div>

              <div className="space-y-2">
                {selectedClientDetails.orders.length > 0 ? (
                  selectedClientDetails.orders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {statusLabels[order.status] ?? order.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(order.total)} DHs -{" "}
                        {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleString("fr-FR")} | Livraison:{" "}
                        {new Date(order.dueDate).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Aucune commande pour ce client.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Impossible de charger le détail client.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
