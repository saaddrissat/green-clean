"use client";

import { ReportProblemKind } from "@prisma/client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Building2,
  FileText,
  Flag,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Upload,
  UserCog,
} from "lucide-react";

import { submitAppReportAction } from "@/app/actions/report";
import { OperationalAlertsCard } from "@/components/settings/operational-alerts-card";
import { PageAccessDialog } from "@/components/settings/page-access-dialog";
import { HardwareStatusStrip } from "@/components/hardware/hardware-status-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AccountItem,
  type AccountRole,
  type PageAccess,
  DEFAULT_CAISSIER_PAGE_ACCESS,
  FULL_PAGE_ACCESS,
  effectivePageAccess,
} from "@/lib/navigation-page-access";
import { getNavigationContext, setNavigationContext } from "@/lib/navigation-context";
import {
  clearHardwareLogs,
  getHardwareLogs,
  type HardwareLogEntry,
} from "@/lib/hardware/debug-log";

type SettingsSection =
  | "entreprise"
  | "factures"
  | "factures-en-ligne"
  | "comptes"
  | "peripheriques"
  | "logs";

type CompanyInfo = {
  commercialName: string;
  email: string;
  city: string;
  postalCode: string;
  phone: string;
  fiscalId: string;
  website: string;
};

type InvoiceInfo = {
  pressingName: string;
  address: string;
  phone: string;
  message: string;
  email: string;
  displayMessage: string;
};

type OnlineInvoiceTemplates = {
  whatsappTemplate: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
};

const LEGACY_SETTINGS_STORAGE_KEY = "gc-settings-v1";

function settingsStorageKeyForUser(userId: string) {
  return `${LEGACY_SETTINGS_STORAGE_KEY}-${userId}`;
}

const REPORT_KIND_OPTIONS: { value: ReportProblemKind; label: string }[] = [
  { value: ReportProblemKind.BUG_TECHNIQUE, label: "Bug ou erreur technique" },
  { value: ReportProblemKind.CONNEXION_COMPTE, label: "Connexion ou compte" },
  { value: ReportProblemKind.CAISSE_COMMANDE, label: "Caisse, commande ou suivi" },
  { value: ReportProblemKind.IMPRESSION_SCANNER, label: "Imprimante, scanner ou périphérique" },
  { value: ReportProblemKind.SUGGESTION, label: "Suggestion d'amélioration" },
  { value: ReportProblemKind.AUTRE, label: "Autre" },
];

export default function ParametresPage() {
  const [settingsUserId, setSettingsUserId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("entreprise");
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<HardwareLogEntry[]>([]);
  const [logoFileName, setLogoFileName] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [newAccount, setNewAccount] = useState({
    fullName: "",
    username: "",
    email: "",
    role: "CAISSIER" as AccountRole,
  });
  const [newAccountPageAccess, setNewAccountPageAccess] = useState<PageAccess>(() => ({
    ...DEFAULT_CAISSIER_PAGE_ACCESS,
  }));
  const [pageAccessOpen, setPageAccessOpen] = useState(false);
  const [pageAccessEditId, setPageAccessEditId] = useState<string | null>(null);
  const [navPreviewValue, setNavPreviewValue] = useState<string>("full");
  const prevRoleRef = useRef<AccountRole>("CAISSIER");
  const accountsPersistReady = useRef(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportFormKey, setReportFormKey] = useState(0);
  const [reportFeedback, setReportFeedback] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [reportPending, startReportTransition] = useTransition();

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    commercialName: "",
    email: "",
    city: "",
    postalCode: "",
    phone: "",
    fiscalId: "",
    website: "",
  });

  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo>({
    pressingName: "",
    address: "",
    phone: "",
    message: "",
    email: "",
    displayMessage: "",
  });
  const [onlineInvoiceTemplates, setOnlineInvoiceTemplates] = useState<OnlineInvoiceTemplates>({
    whatsappTemplate:
      "Bonjour {clientName}, votre facture {invoiceNumber} est prête. Total: {total}. Merci de votre confiance.",
    emailSubjectTemplate: "Votre facture {invoiceNumber} - {pressingName}",
    emailBodyTemplate:
      "Bonjour {clientName},\n\nVeuillez trouver votre facture {invoiceNumber}.\nMontant total: {total}.\n\nMerci,\n{pressingName}",
  });

  function handleReportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportFeedback(null);
    const fd = new FormData(event.currentTarget);
    startReportTransition(() => {
      void submitAppReportAction(null, fd).then((result) => {
        if (result?.ok) {
          setReportOpen(false);
          setReportFormKey((k) => k + 1);
          setReportFeedback({ ok: true });
        } else {
          setReportFeedback({ error: result?.error ?? "Erreur." });
        }
      });
    });
  }

  useEffect(() => {
    const syncLogs = () => setLogs(getHardwareLogs());
    syncLogs();
    window.addEventListener("gc-hardware-logs-updated", syncLogs);
    return () => window.removeEventListener("gc-hardware-logs-updated", syncLogs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { id?: string } | null) => {
        if (cancelled || !data?.id) return;
        setSettingsUserId(data.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsUserId || typeof window === "undefined") return;
    const key = settingsStorageKeyForUser(settingsUserId);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        companyInfo?: CompanyInfo;
        invoiceInfo?: InvoiceInfo;
        onlineInvoiceTemplates?: OnlineInvoiceTemplates;
        accounts?: AccountItem[];
        logoFileName?: string;
        logoPreviewUrl?: string | null;
      };
      if (parsed.companyInfo) setCompanyInfo(parsed.companyInfo);
      if (parsed.invoiceInfo) setInvoiceInfo(parsed.invoiceInfo);
      if (parsed.onlineInvoiceTemplates) setOnlineInvoiceTemplates(parsed.onlineInvoiceTemplates);
      if (parsed.accounts) setAccounts(parsed.accounts);
      if (parsed.logoFileName) setLogoFileName(parsed.logoFileName);
      if (parsed.logoPreviewUrl) setLogoPreviewUrl(parsed.logoPreviewUrl);
      setLastSavedSnapshot(raw);
    } catch {
      localStorage.removeItem(key);
    }
  }, [settingsUserId]);

  useEffect(() => {
    const ctx = getNavigationContext();
    if (ctx.mode === "full") setNavPreviewValue("full");
    else setNavPreviewValue(ctx.accountId);
  }, []);

  useEffect(() => {
    const prev = prevRoleRef.current;
    if (prev !== "CAISSIER" && newAccount.role === "CAISSIER") {
      setNewAccountPageAccess({ ...DEFAULT_CAISSIER_PAGE_ACCESS });
    }
    prevRoleRef.current = newAccount.role;
  }, [newAccount.role]);

  useEffect(() => {
    setInvoiceInfo((prev) => ({
      ...prev,
      pressingName: prev.pressingName || companyInfo.commercialName,
      phone: prev.phone || companyInfo.phone,
      email: prev.email || companyInfo.email,
      address:
        prev.address ||
        [companyInfo.city, companyInfo.postalCode].filter(Boolean).join(", "),
    }));
  }, [companyInfo]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const sections = useMemo(
    () => [
      { id: "entreprise" as const, label: "Informations entreprise", icon: Building2 },
      { id: "factures" as const, label: "Factures", icon: FileText },
      { id: "factures-en-ligne" as const, label: "Factures en ligne", icon: FileText },
      { id: "comptes" as const, label: "Gestion des comptes", icon: UserCog },
      { id: "peripheriques" as const, label: "Périphériques", icon: HardDrive },
      { id: "logs" as const, label: "Console hardware", icon: HardDrive },
    ],
    [],
  );

  const updateCompany = <K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) => {
    setCompanyInfo((prev) => ({ ...prev, [key]: value }));
  };

  const updateInvoice = <K extends keyof InvoiceInfo>(key: K, value: InvoiceInfo[K]) => {
    setInvoiceInfo((prev) => ({ ...prev, [key]: value }));
  };

  const setLogoFile = (file: File | null) => {
    if (!file) return;
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(objectUrl);
    setLogoFileName(file.name);
  };

  const scrollToSection = (sectionId: SettingsSection) => {
    setActiveSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const addAccount = () => {
    const fullName = newAccount.fullName.trim();
    const username = newAccount.username.trim();
    const email = newAccount.email.trim().toLowerCase();

    if (!fullName || !username || !email) {
      setAccountMessage("Nom, identifiant et email sont requis.");
      return;
    }

    const duplicate = accounts.some(
      (item) => item.username.toLowerCase() === username.toLowerCase() || item.email.toLowerCase() === email,
    );
    if (duplicate) {
      setAccountMessage("Un compte avec cet identifiant ou email existe déjà.");
      return;
    }

    const created: AccountItem = {
      id: `acc-${Date.now()}`,
      fullName,
      username,
      email,
      role: newAccount.role,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      sessionDurationMinutes: null,
      pageAccess: newAccount.role === "CAISSIER" ? newAccountPageAccess : FULL_PAGE_ACCESS,
    };
    setAccounts((prev) => [created, ...prev]);
    setNewAccount({ fullName: "", username: "", email: "", role: "CAISSIER" });
    setNewAccountPageAccess({ ...DEFAULT_CAISSIER_PAGE_ACCESS });
    setAccountMessage("Compte ajouté.");
    window.dispatchEvent(new CustomEvent("gc-settings-updated"));
  };

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        companyInfo,
        invoiceInfo,
        onlineInvoiceTemplates,
        accounts,
        logoFileName,
        logoPreviewUrl,
      }),
    [companyInfo, invoiceInfo, onlineInvoiceTemplates, accounts, logoFileName, logoPreviewUrl],
  );

  /** Après l’hydratation initiale, synchronise les comptes vers le stockage pour l’aperçu du menu. */
  useEffect(() => {
    if (!settingsUserId) return;
    if (!accountsPersistReady.current) {
      accountsPersistReady.current = true;
      return;
    }
    try {
      localStorage.setItem(
        settingsStorageKeyForUser(settingsUserId),
        JSON.stringify({
          companyInfo,
          invoiceInfo,
          onlineInvoiceTemplates,
          accounts,
          logoFileName,
          logoPreviewUrl,
        }),
      );
      window.dispatchEvent(new CustomEvent("gc-settings-updated"));
    } catch {
      // quota / mode privé
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- déclenché sur les comptes ; le snapshot joint lit l’état courant au même rendu.
  }, [accounts, settingsUserId]);

  const hasChanges = currentSnapshot !== lastSavedSnapshot;

  const handleSaveSettings = () => {
    if (!settingsUserId) {
      setSaveMessage("Session non chargée — réessayez dans un instant.");
      return;
    }
    try {
      localStorage.setItem(settingsStorageKeyForUser(settingsUserId), currentSnapshot);
      setLastSavedSnapshot(currentSnapshot);
      setSaveMessage("Informations enregistrées.");
      window.dispatchEvent(new CustomEvent("gc-settings-updated"));
    } catch {
      setSaveMessage("Échec de l'enregistrement local.");
    }
  };

  const editingAccount = pageAccessEditId ? accounts.find((a) => a.id === pageAccessEditId) : undefined;

  const pageAccessDialogValue = useMemo(() => {
    if (pageAccessEditId && editingAccount) return effectivePageAccess(editingAccount);
    return newAccountPageAccess;
  }, [pageAccessEditId, editingAccount, newAccountPageAccess]);

  const pageAccessDialogFull = pageAccessEditId
    ? editingAccount?.role === "ADMIN"
    : newAccount.role === "ADMIN";

  return (
    <div className="space-y-0 md:flex md:items-start md:gap-4">
      <div
        className={`hidden border-r border-slate-200 bg-white md:sticky md:top-6 md:block md:h-[calc(100dvh-3rem)] md:shrink-0 ${
          isMenuOpen ? "md:w-[210px]" : "md:w-[86px]"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 p-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMenuOpen((value) => !value)}
              className="min-h-10 w-full justify-center"
            >
              {isMenuOpen ? (
                <>
                  <PanelLeftClose className="h-5 w-5" />
                  <span className="ml-2">Menu</span>
                </>
              ) : (
                <PanelLeftOpen className="h-6 w-6" />
              )}
            </Button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`flex w-full items-center rounded-xl border px-3 py-2 text-left text-sm transition ${
                    activeSection === section.id
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } ${isMenuOpen ? "gap-2" : "justify-center px-2"}`}
                  title={section.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {isMenuOpen ? <span className="line-clamp-2">{section.label}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-6xl min-w-0 flex-1 space-y-4 px-0"
      >
        <div className="md:hidden">
          <Card>
            <CardContent className="space-y-2 p-3">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                      activeSection === section.id
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div id="section-entreprise" className="scroll-mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="max-w-2xl">
              <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Parametres</h1>
              <p className="text-sm text-slate-500">
                Gérez les informations de votre pressing, la personnalisation des factures et le matériel.
              </p>
            </div>
            <div className="flex w-full items-center justify-end gap-2 md:ml-auto md:w-auto">
              {saveMessage ? <p className="text-xs text-slate-500">{saveMessage}</p> : null}
              <Button type="button" className="w-full sm:w-auto" onClick={handleSaveSettings} disabled={!hasChanges}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations de l&apos;entreprise</CardTitle>
            <CardDescription>
              Ces données servent de base pour les documents et la configuration boutique.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <input
              value={companyInfo.commercialName}
              onChange={(event) => updateCompany("commercialName", event.target.value)}
              placeholder="Nom commercial"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={companyInfo.email}
              onChange={(event) => updateCompany("email", event.target.value)}
              placeholder="Adresse mail"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={companyInfo.city}
              onChange={(event) => updateCompany("city", event.target.value)}
              placeholder="Ville"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={companyInfo.postalCode}
              onChange={(event) => updateCompany("postalCode", event.target.value)}
              placeholder="Code postal"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={companyInfo.phone}
              onChange={(event) => updateCompany("phone", event.target.value)}
              placeholder="Téléphone"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={companyInfo.fiscalId}
              onChange={(event) => updateCompany("fiscalId", event.target.value)}
              placeholder="Identifiant fiscale / ICE"
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            />
            <input
              value={companyInfo.website}
              onChange={(event) => updateCompany("website", event.target.value)}
              placeholder="Site web"
              className="min-h-11 rounded-xl border border-slate-300 px-3 md:col-span-2"
            />
          </CardContent>
        </Card>

        <OperationalAlertsCard />

        <Card id="section-factures" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Factures</CardTitle>
            <CardDescription>
              Personnalisez vos informations d&apos;impression. Les champs sont préremplis depuis
              “Informations entreprise”.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0] ?? null;
                setLogoFile(file);
              }}
            >
              <Upload className="h-6 w-6 text-slate-500" />
              <p className="mt-2 text-sm font-medium text-slate-700">Glissez-déposez votre logo ici</p>
              <p className="mt-1 text-xs text-slate-500">ou cliquez pour choisir un fichier image</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setLogoFile(file);
                }}
              />
            </label>

            {logoPreviewUrl ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">{logoFileName}</p>
                <img
                  src={logoPreviewUrl}
                  alt="Aperçu logo"
                  className="mt-2 h-20 w-auto rounded-lg border border-slate-200 object-contain"
                />
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={invoiceInfo.pressingName}
                onChange={(event) => updateInvoice("pressingName", event.target.value)}
                placeholder="Nom du pressing"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <input
                value={invoiceInfo.address}
                onChange={(event) => updateInvoice("address", event.target.value)}
                placeholder="Adresse"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <input
                value={invoiceInfo.phone}
                onChange={(event) => updateInvoice("phone", event.target.value)}
                placeholder="N° téléphone"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <input
                value={invoiceInfo.email}
                onChange={(event) => updateInvoice("email", event.target.value)}
                placeholder="Email"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <input
                value={invoiceInfo.message}
                onChange={(event) => updateInvoice("message", event.target.value)}
                placeholder="Message"
                className="min-h-11 rounded-xl border border-slate-300 px-3 md:col-span-2"
              />
              <input
                value={invoiceInfo.displayMessage}
                onChange={(event) => updateInvoice("displayMessage", event.target.value)}
                placeholder="Message d'affichage (ex: Bienvenue chez-nous)"
                className="min-h-11 rounded-xl border border-slate-300 px-3 md:col-span-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card id="section-comptes" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Gestion des comptes</CardTitle>
            <CardDescription>
              Ajoutez des comptes Caissier et Admin. Pour chaque caissier, choisissez les pages visibles dans le menu
              (par défaut : Caisse, Suivi, Clients).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Aperçu du menu (navigation)
              </label>
              <select
                value={navPreviewValue}
                onChange={(event) => {
                  const v = event.target.value;
                  setNavPreviewValue(v);
                  if (v === "full") setNavigationContext({ mode: "full" });
                  else setNavigationContext({ mode: "restricted", accountId: v });
                }}
                className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="full">Toutes les pages (admin)</option>
                {accounts
                  .filter((a) => a.role === "CAISSIER")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      Caissier · {a.fullName}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Permet de simuler le menu latéral vu par un caissier après configuration des pages.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newAccount.fullName}
                onChange={(event) =>
                  setNewAccount((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Nom complet"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <input
                value={newAccount.username}
                onChange={(event) =>
                  setNewAccount((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="Identifiant"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <input
                value={newAccount.email}
                onChange={(event) =>
                  setNewAccount((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="Email"
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              />
              <select
                value={newAccount.role}
                onChange={(event) =>
                  setNewAccount((prev) => ({ ...prev, role: event.target.value as AccountRole }))
                }
                className="min-h-11 rounded-xl border border-slate-300 px-3"
              >
                <option value="CAISSIER">Caissier</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {newAccount.role === "ADMIN" ? (
              <p className="text-sm text-slate-600">
                Les administrateurs ont automatiquement accès à toutes les pages.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Accès par défaut : <strong>Caisse</strong>, <strong>Suivi</strong>, <strong>Clients</strong>. Ajustez
                  avec le bouton ci-dessous.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-emerald-400/60 bg-gradient-to-r from-emerald-50 via-white to-teal-50 text-emerald-900 shadow-sm hover:from-emerald-100 hover:to-teal-100"
                  onClick={() => {
                    setPageAccessEditId(null);
                    setPageAccessOpen(true);
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Personnaliser l&apos;accès aux pages
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {accountMessage ? <p className="text-xs text-slate-500">{accountMessage}</p> : <span />}
              <Button type="button" onClick={addAccount}>
                Ajouter un compte
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[920px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Nom</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Identifiant</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Email</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Rôle</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Pages</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Dernière connexion</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Durée de connexion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length > 0 ? (
                    accounts.map((account) => (
                      <tr key={account.id} className="text-sm text-slate-700">
                        <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                          {account.fullName}
                        </td>
                        <td className="border-b border-slate-200 px-4 py-3">{account.username}</td>
                        <td className="border-b border-slate-200 px-4 py-3">{account.email}</td>
                        <td className="border-b border-slate-200 px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              account.role === "ADMIN"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {account.role === "ADMIN" ? "Admin" : "Caissier"}
                          </span>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-3">
                          {account.role === "CAISSIER" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 border-emerald-400/50 text-emerald-900"
                              onClick={() => {
                                setPageAccessEditId(account.id);
                                setPageAccessOpen(true);
                              }}
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                              Personnaliser
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">Toutes les pages</span>
                          )}
                        </td>
                        <td className="border-b border-slate-200 px-4 py-3">
                          {account.lastLoginAt
                            ? new Date(account.lastLoginAt).toLocaleString("fr-FR")
                            : "Jamais connecté"}
                        </td>
                        <td className="border-b border-slate-200 px-4 py-3">
                          {account.sessionDurationMinutes == null
                            ? "-"
                            : `${Math.floor(account.sessionDurationMinutes / 60)}h ${account.sessionDurationMinutes % 60}min`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-sm text-slate-500" colSpan={7}>
                        Aucun compte ajouté pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <PageAccessDialog
              open={pageAccessOpen}
              onOpenChange={(open) => {
                setPageAccessOpen(open);
                if (!open) setPageAccessEditId(null);
              }}
              value={pageAccessDialogValue}
              onChange={(next) => {
                if (pageAccessEditId) {
                  setAccounts((prev) =>
                    prev.map((a) => (a.id === pageAccessEditId ? { ...a, pageAccess: next } : a)),
                  );
                } else {
                  setNewAccountPageAccess(next);
                }
              }}
              fullAccess={pageAccessDialogFull}
              title={
                pageAccessEditId
                  ? `Accès aux pages · ${editingAccount?.fullName ?? ""}`
                  : "Accès aux pages (nouveau caissier)"
              }
            />
          </CardContent>
        </Card>

        <Card id="section-factures-en-ligne" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Factures en ligne</CardTitle>
            <CardDescription>
              Personnalisez les messages envoyés avec les factures en ligne via WhatsApp et Email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Variables disponibles: {"{clientName}"}, {"{invoiceNumber}"}, {"{total}"},{" "}
              {"{pressingName}"}.
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Message WhatsApp</p>
              <textarea
                value={onlineInvoiceTemplates.whatsappTemplate}
                onChange={(event) =>
                  setOnlineInvoiceTemplates((prev) => ({
                    ...prev,
                    whatsappTemplate: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Objet Email</p>
              <input
                value={onlineInvoiceTemplates.emailSubjectTemplate}
                onChange={(event) =>
                  setOnlineInvoiceTemplates((prev) => ({
                    ...prev,
                    emailSubjectTemplate: event.target.value,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Corps Email</p>
              <textarea
                value={onlineInvoiceTemplates.emailBodyTemplate}
                onChange={(event) =>
                  setOnlineInvoiceTemplates((prev) => ({
                    ...prev,
                    emailBodyTemplate: event.target.value,
                  }))
                }
                rows={7}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card id="section-peripheriques" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Périphériques</CardTitle>
            <CardDescription>Imprimante ticket et rappel pour le scanner USB.</CardDescription>
          </CardHeader>
          <CardContent>
            <HardwareStatusStrip />
          </CardContent>
        </Card>

        <Card id="section-logs" className="scroll-mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Console hardware</CardTitle>
              <CardDescription>Logs de communication imprimante/scanner.</CardDescription>
            </div>
            <Button variant="ghost" onClick={() => setShowLogs((value) => !value)}>
              {showLogs ? "Masquer logs" : "Afficher logs"}
            </Button>
          </CardHeader>
          {showLogs ? (
            <CardContent className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    clearHardwareLogs();
                    setLogs([]);
                  }}
                >
                  Vider les logs
                </Button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-300">Aucun log pour le moment.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-200">
                      <p className={log.level === "error" ? "text-rose-300" : "text-emerald-300"}>
                        [{log.level.toUpperCase()}] {new Date(log.timestamp).toLocaleString("fr-FR")}
                      </p>
                      <p className="mt-1">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Card id="section-signalement" className="scroll-mt-4 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 shrink-0 text-rose-600" aria-hidden />
              Signalement
            </CardTitle>
            <CardDescription>
              Indiquez le type de problème et décrivez ce qui s&apos;est passé. Le message est enregistré avec votre
              compte pour traitement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 bg-rose-50/80 text-rose-900 hover:bg-rose-100"
              onClick={() => {
                setReportFeedback(null);
                setReportOpen(true);
              }}
            >
              Signaler un problème
            </Button>
            {reportFeedback?.ok ? (
              <p className="text-sm text-emerald-600">Merci, votre signalement a bien été enregistré.</p>
            ) : null}
          </CardContent>
        </Card>

        <Dialog
          open={reportOpen}
          onOpenChange={(open) => {
            setReportOpen(open);
            if (open) {
              setReportFeedback(null);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Signaler un problème</DialogTitle>
              <DialogDescription>
                Choisissez une catégorie et détaillez votre message (minimum 10 caractères).
              </DialogDescription>
            </DialogHeader>
            <form key={reportFormKey} className="space-y-4" onSubmit={handleReportSubmit}>
              <div className="space-y-2">
                <label htmlFor="report-kind" className="text-sm font-medium text-slate-800">
                  Type de problème
                </label>
                <select
                  id="report-kind"
                  name="kind"
                  required
                  defaultValue={REPORT_KIND_OPTIONS[0]?.value}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  {REPORT_KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="report-message" className="text-sm font-medium text-slate-800">
                  Votre message
                </label>
                <textarea
                  id="report-message"
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  placeholder="Décrivez le problème ou la suggestion…"
                  className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>
              {reportFeedback?.error ? (
                <p className="text-sm text-rose-600" role="alert">
                  {reportFeedback.error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={reportPending}>
                  {reportPending ? "Envoi…" : "Envoyer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex justify-end pb-2">
          <Button type="button" className="w-full sm:w-auto" onClick={handleSaveSettings} disabled={!hasChanges}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
