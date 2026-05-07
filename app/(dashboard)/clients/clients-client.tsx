"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { MessageCircle, Minus, Pencil, Plus, Search, SendHorizontal, Trash2 } from "lucide-react";

import {
  createClientAction,
  deleteClientAction,
  getClientLatestInvoiceAction,
  getClientBalancesAction,
  getClientDetailsAction,
  getRecentClientOrdersAction,
  sendClientInvoiceAction,
  updateClientAction,
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
  storeCredit?: number;
};

type ClientsClientProps = {
  initialClients: ClientRow[];
};

type ClientDetails = Awaited<ReturnType<typeof getClientDetailsAction>>;
type RecentClientOrders = Awaited<ReturnType<typeof getRecentClientOrdersAction>>;
type SmtpSettings = {
  email: string;
  pass: string;
};

const SMTP_SETTINGS_STORAGE_KEY = "gc-smtp-settings-v1";

const statusLabels: Record<string, string> = {
  RECU: "Recu",
  EN_COURS: "En cours",
  TERMINE: "Termine",
  LIVRE: "Livre",
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte bancaire",
  MOBILE_MONEY: "Crédit",
  CREDIT: "Crédit",
};

const formatDh = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} DHs`;

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
  const [balancesByClient, setBalancesByClient] = useState<Record<string, { balanceDue: number; storeCredit: number }>>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStoreCredit, setEditStoreCredit] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  /** Nom affiché tout de suite à l’ouverture (sans attendre le serveur). */
  const [detailPreviewName, setDetailPreviewName] = useState<string | null>(null);
  /** Erreur chargement détail — visible dans la popup (pas seulement sous la liste). */
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [invoiceSendOpen, setInvoiceSendOpen] = useState(false);
  const [invoiceTargetClient, setInvoiceTargetClient] = useState<ClientRow | null>(null);
  const [sendPending, setSendPending] = useState(false);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    email: "",
    pass: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(SMTP_SETTINGS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SmtpSettings>;
      setSmtpSettings((prev) => ({
        email: parsed.email ?? prev.email,
        pass: parsed.pass ?? prev.pass,
      }));
    } catch {
      localStorage.removeItem(SMTP_SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [recent, balances] = await Promise.all([
          getRecentClientOrdersAction(),
          getClientBalancesAction(),
        ]);
        setRecentOrders(recent);
        setBalancesByClient(
          balances.reduce<Record<string, { balanceDue: number; storeCredit: number }>>((acc, entry) => {
            acc[entry.clientId] = { balanceDue: entry.balanceDue, storeCredit: entry.storeCredit };
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

  const refreshBalances = async () => {
    try {
      const balances = await getClientBalancesAction();
      setBalancesByClient(
        balances.reduce<Record<string, { balanceDue: number; storeCredit: number }>>((acc, entry) => {
          acc[entry.clientId] = { balanceDue: entry.balanceDue, storeCredit: entry.storeCredit };
          return acc;
        }, {}),
      );
    } catch {
      /* ignore */
    }
  };

  const openInvoiceSendDialog = (client: ClientRow) => {
    setInvoiceTargetClient(client);
    setInvoiceSendOpen(true);
  };

  const sendInvoiceByEmail = async (client: ClientRow) => {
    setMessage("");
    setSendPending(true);
    try {
      const sent = await sendClientInvoiceAction({
        clientId: client.id,
        smtpOverride: {
          host: "smtp.gmail.com",
          port: 587,
          user: smtpSettings.email,
          pass: smtpSettings.pass,
          from: smtpSettings.email,
        },
      });
      setMessage(`Facture envoyée à ${sent.recipient} (${sent.orderNumber}) avec succès.`);
      setInvoiceSendOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur envoi facture.");
    } finally {
      setSendPending(false);
    }
  };

  const sendInvoiceByWhatsApp = (client: ClientRow) => {
    const run = async () => {
      setMessage("");
      try {
        const invoice = await getClientLatestInvoiceAction(client.id);
        if (!invoice.phone) {
          setMessage("Ce client n'a pas de numéro WhatsApp.");
          return;
        }
        const digits = invoice.phone.replace(/\D/g, "");
        if (!digits) {
          setMessage("Numéro WhatsApp invalide.");
          return;
        }
        const number = digits.startsWith("0") && digits.length === 10 ? `212${digits.slice(1)}` : digits;
        const totalFormatted = `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(invoice.total)} DH`;
        const invoiceDate = new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(invoice.orderDateIso));
        const fileName = `facture-${invoice.orderNumber}.pdf`;
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text("FACTURE", 20, 20);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text("Green Clean", 20, 30);
        pdf.text(`Client: ${invoice.clientName}`, 20, 42);
        pdf.text(`Numero: ${invoice.orderNumber}`, 20, 50);
        pdf.text(`Date: ${invoiceDate}`, 20, 58);
        pdf.text(`Montant total: ${totalFormatted}`, 20, 66);
        pdf.setDrawColor(210, 210, 210);
        pdf.line(20, 74, 190, 74);
        pdf.setFontSize(10);
        pdf.text("Merci de votre confiance.", 20, 82);
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const waMessage = `Bonjour ${invoice.clientName}, votre facture ${invoice.orderNumber} (${totalFormatted}) est prête. Le fichier a été téléchargé sur votre appareil.`;

        // Sur mobile/support natif, essaie d'envoyer texte + fichier dans le même partage.
        if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
          const file = new File([blob], fileName, { type: "application/pdf" });
          const canShareFile = (navigator as Navigator & { canShare?: (data: ShareData) => boolean }).canShare?.({
            files: [file],
          });
          if (canShareFile) {
            try {
              await navigator.share({ text: waMessage, files: [file], title: `Facture ${invoice.orderNumber}` });
            } catch {
              // L'utilisateur peut annuler le partage; on continue vers WhatsApp.
            }
          }
        }

        window.open(`https://wa.me/${number}?text=${encodeURIComponent(waMessage)}`, "_blank", "noopener,noreferrer");
        setInvoiceSendOpen(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Erreur envoi WhatsApp.");
      }
    };
    void run();
  };

  const handleAddClient = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const created = await createClientAction({ fullName, phone, email });
      setClients((prev) => [
        {
          id: created.id,
          fullName: created.fullName,
          phone: created.phone,
          email: created.email,
          totalOrders: created.totalOrders,
          storeCredit: created.storeCredit ?? 0,
        },
        ...prev,
      ]);
      setFullName("");
      setPhone("");
      setEmail("");
      setMessage("Client ajouté avec succès.");
      setIsAddClientOpen(false);
      void refreshBalances();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur ajout client.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenClientDetails = async (
    client: ClientRow,
    options?: { openInEditMode?: boolean },
  ) => {
    setIsHistoryLoading(true);
    setDetailsError(null);
    setDetailPreviewName(client.fullName);
    setMessage("");
    setEditMode(false);
    setIsClientDetailsOpen(true);
    try {
      const details = await getClientDetailsAction(client.id);
      setSelectedClientDetails(details);
      setEditFullName(details.client.fullName);
      setEditPhone(details.client.phone ?? "");
      setEditEmail(details.client.email ?? "");
      setEditStoreCredit(
        typeof details.client.storeCredit === "number" ? details.client.storeCredit : 0,
      );
      setEditMode(options?.openInEditMode ?? false);
    } catch (error) {
      setSelectedClientDetails(null);
      const msg = error instanceof Error ? error.message : "Erreur chargement historique.";
      setDetailsError(msg);
      setMessage(msg);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const beginEdit = () => {
    if (!selectedClientDetails) return;
    setEditFullName(selectedClientDetails.client.fullName);
    setEditPhone(selectedClientDetails.client.phone ?? "");
    setEditEmail(selectedClientDetails.client.email ?? "");
    setEditStoreCredit(selectedClientDetails.client.storeCredit ?? 0);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    if (selectedClientDetails) {
      setEditFullName(selectedClientDetails.client.fullName);
      setEditPhone(selectedClientDetails.client.phone ?? "");
      setEditEmail(selectedClientDetails.client.email ?? "");
      setEditStoreCredit(selectedClientDetails.client.storeCredit ?? 0);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedClientDetails) return;
    setIsSavingEdit(true);
    setMessage("");
    try {
      await updateClientAction({
        clientId: selectedClientDetails.client.id,
        fullName: editFullName,
        phone: editPhone || null,
        email: editEmail || null,
        storeCredit: editStoreCredit,
      });
      const details = await getClientDetailsAction(selectedClientDetails.client.id);
      setSelectedClientDetails(details);
      setClients((prev) =>
        prev.map((c) =>
          c.id === details.client.id
            ? {
                ...c,
                fullName: details.client.fullName,
                phone: details.client.phone,
                email: details.client.email,
                storeCredit: details.client.storeCredit,
              }
            : c,
        ),
      );
      setEditMode(false);
      setMessage("Client mis à jour.");
      void refreshBalances();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur enregistrement.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const adjustCredit = (delta: number) => {
    setEditStoreCredit((prev) => Math.round((prev + delta) * 100) / 100);
  };

  const selectedId = selectedClientDetails?.client.id;

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
          <table className="w-full min-w-[960px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-sm text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Nom</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Téléphone</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Email</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Total commandes</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Crédit / Solde</th>
                <th className="min-w-[168px] border-b border-slate-200 px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenClientDetails(client)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenClientDetails(client);
                    }
                  }}
                  className="cursor-pointer text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <td className="border-b border-slate-200 px-4 py-4 font-semibold text-slate-900">
                    {client.fullName}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-4">{client.phone ?? "-"}</td>
                  <td className="border-b border-slate-200 px-4 py-4">{client.email ?? "-"}</td>
                  <td className="border-b border-slate-200 px-4 py-4 text-right font-semibold">
                    {client.totalOrders}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-4 text-right">
                    {(balancesByClient[client.id]?.balanceDue ?? 0) > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Reste: {formatDh(balancesByClient[client.id]?.balanceDue ?? 0)}
                      </span>
                    ) : (balancesByClient[client.id]?.storeCredit ?? 0) > 0 ? (
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                        Crédit: {formatDh(balancesByClient[client.id]?.storeCredit ?? 0)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        Solde OK
                      </span>
                    )}
                  </td>
                  <td
                    className="min-w-[168px] border-b border-slate-200 px-4 py-4"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 shrink-0 rounded-lg border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                        aria-label="Modifier le client"
                        title="Modifier"
                        onClick={() => void handleOpenClientDetails(client, { openInEditMode: true })}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 shrink-0 rounded-lg text-slate-900"
                        aria-label="Envoyer la facture par email"
                        title="Envoyer la facture"
                        onClick={() => openInvoiceSendDialog(client)}
                      >
                        <SendHorizontal className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 shrink-0 rounded-lg text-slate-900"
                        aria-label="Supprimer le client"
                        title="Supprimer"
                        onClick={async () => {
                          setMessage("");
                          try {
                            await deleteClientAction(client.id);
                            setClients((prev) => prev.filter((entry) => entry.id !== client.id));
                            if (selectedClientDetails?.client.id === client.id) {
                              setSelectedClientDetails(null);
                              setIsClientDetailsOpen(false);
                            }
                            setMessage("Client supprimé avec succès.");
                            void refreshBalances();
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Erreur suppression client.");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
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

      <Dialog
        open={invoiceSendOpen}
        onOpenChange={(open) => {
          setInvoiceSendOpen(open);
          if (!open) setInvoiceTargetClient(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Envoyer la facture</DialogTitle>
            <DialogDescription>
              Choisissez le canal d&apos;envoi pour {invoiceTargetClient?.fullName ?? "ce client"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm">
              <p className="text-slate-700">
                <span className="font-semibold">Email:</span> {invoiceTargetClient?.email ?? "Non renseigné"}
              </p>
              <p className="text-slate-700">
                <span className="font-semibold">WhatsApp:</span> {invoiceTargetClient?.phone ?? "Non renseigné"}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2"
                disabled={!invoiceTargetClient?.phone}
                onClick={() => invoiceTargetClient && sendInvoiceByWhatsApp(invoiceTargetClient)}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                type="button"
                className="justify-start gap-2"
                disabled={!invoiceTargetClient?.email || sendPending}
                onClick={() => invoiceTargetClient && void sendInvoiceByEmail(invoiceTargetClient)}
              >
                <SendHorizontal className="h-4 w-4" />
                {sendPending ? "Envoi..." : "Email"}
              </Button>
            </div>
            {!smtpSettings.email || !smtpSettings.pass ? (
              <p className="text-xs text-amber-700">
                SMTP incomplet. Configurez-le dans Paramètres &gt; Factures en ligne.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientDetailsOpen}
        onOpenChange={(open) => {
          setIsClientDetailsOpen(open);
          if (!open) {
            setEditMode(false);
            setSelectedClientDetails(null);
            setDetailPreviewName(null);
            setDetailsError(null);
          }
        }}
      >
        <DialogContent className="flex h-[min(90dvh,760px)] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <div className="shrink-0 border-b border-slate-100 px-6 pb-4 pt-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>Historique & détails client</DialogTitle>
              <DialogDescription asChild>
                <span className="block text-sm">
                  {detailsError ? (
                    <span className="font-medium text-rose-600">{detailsError}</span>
                  ) : isHistoryLoading ? (
                    <span className="text-slate-500">
                      Chargement…{" "}
                      <span className="font-medium text-slate-700">
                        {detailPreviewName ?? selectedClientDetails?.client.fullName ?? ""}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-slate-700">
                      {selectedClientDetails?.client.fullName ?? detailPreviewName ?? "Client"}
                    </span>
                  )}
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-[min(50dvh,420px)] flex-1 overflow-y-auto px-6 py-4">
            {isHistoryLoading ? (
              <div className="flex flex-col gap-2 py-8 text-center">
                <p className="text-sm font-medium text-slate-600">Chargement de l&apos;historique…</p>
                <p className="text-xs text-slate-500">
                  {detailPreviewName ? `Client : ${detailPreviewName}` : null}
                </p>
              </div>
            ) : selectedClientDetails ? (
              <div className="space-y-4">
                {editMode ? (
                  <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-800">Modifier le client</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-600">Nom complet</span>
                        <input
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="min-h-10 rounded-lg border border-slate-300 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-600">Téléphone</span>
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="min-h-10 rounded-lg border border-slate-300 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-sm md:col-span-2">
                        <span className="text-slate-600">Email</span>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="min-h-10 rounded-lg border border-slate-300 px-3"
                        />
                      </label>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-medium text-slate-600">Crédit clients</p>
                      <p className="mb-2 text-xs text-slate-500">
                        Positif: montant que le magasin doit au client. Négatif: montant que le client doit au magasin.
                        Utilisez les boutons pour ajuster.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => adjustCredit(-100)}>
                          <Minus className="h-4 w-4" />
                          100
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => adjustCredit(100)}>
                          <Plus className="h-4 w-4" />
                          100
                        </Button>
                        <input
                          type="number"
                          step={1}
                          value={editStoreCredit || ""}
                          onChange={(e) =>
                            setEditStoreCredit(e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0)
                          }
                          className="min-h-10 w-32 rounded-lg border border-slate-300 px-2 text-sm"
                        />
                        <span className="text-xs text-slate-500">DHs</span>
                      </div>
                    </div>
                  </div>
                ) : (
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
                      <span className="font-semibold">Commandes non livrées (brut):</span>{" "}
                      {formatDh(selectedClientDetails.client.ordersOwed ?? 0)}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Crédit clients:</span>{" "}
                      {formatDh(selectedClientDetails.client.storeCredit ?? 0)}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Reste à payer:</span>{" "}
                      {(selectedClientDetails.client.balanceDue ?? 0) > 0
                        ? formatDh(selectedClientDetails.client.balanceDue ?? 0)
                        : (selectedClientDetails.client.storeCredit ?? 0) > 0
                          ? `Crédit: ${formatDh(selectedClientDetails.client.storeCredit ?? 0)}`
                          : "Solde OK"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800">Historique des commandes</p>
                  {selectedClientDetails.orders.length > 0 ? (
                    selectedClientDetails.orders.map((order) => (
                      <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {statusLabels[order.status] ?? order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDh(order.total)} — {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleString("fr-FR")} | Livraison:{" "}
                          {new Date(order.dueDate).toLocaleDateString("fr-FR")}
                        </p>
                        {order.items.length > 0 ? (
                          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                            {order.items.map((item) => (
                              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                                <span>
                                  {item.productName} ({item.optionLabel}) × {item.quantity}
                                </span>
                                <span className="font-medium text-slate-800">{formatDh(item.lineTotal)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
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
              <div className="rounded-xl border border-rose-100 bg-rose-50/90 px-4 py-6 text-center">
                <p className="text-sm font-medium text-rose-800">
                  {detailsError ?? "Impossible de charger le détail de ce client."}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!editMode ? (
                <>
                  <Button type="button" variant="outline" disabled={!selectedId} onClick={beginEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedId}
                    onClick={() => {
                      if (!selectedClientDetails?.client) return;
                      openInvoiceSendDialog({
                        id: selectedClientDetails.client.id,
                        fullName: selectedClientDetails.client.fullName,
                        phone: selectedClientDetails.client.phone,
                        email: selectedClientDetails.client.email,
                        totalOrders: 0,
                      });
                    }}
                  >
                    <SendHorizontal className="mr-2 h-4 w-4" />
                    Envoyer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-200 text-rose-800 hover:bg-rose-50"
                    disabled={!selectedId}
                    onClick={async () => {
                      if (!selectedId) return;
                      setMessage("");
                      try {
                        await deleteClientAction(selectedId);
                        setClients((prev) => prev.filter((entry) => entry.id !== selectedId));
                        setIsClientDetailsOpen(false);
                        setSelectedClientDetails(null);
                        setMessage("Client supprimé avec succès.");
                        void refreshBalances();
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Erreur suppression client.");
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSavingEdit}>
                    Annuler
                  </Button>
                  <Button type="button" onClick={() => void handleSaveEdit()} disabled={isSavingEdit || !editFullName.trim()}>
                    {isSavingEdit ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
