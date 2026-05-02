"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, FileText, HardDrive, PanelLeftClose, PanelLeftOpen, Upload, UserCog } from "lucide-react";

import { HardwareStatusStrip } from "@/components/hardware/hardware-status-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type AccountRole = "CAISSIER" | "ADMIN";

type AccountItem = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: AccountRole;
  createdAt: string;
  lastLoginAt: string | null;
  sessionDurationMinutes: number | null;
};

const SETTINGS_STORAGE_KEY = "gc-settings-v1";

export default function ParametresPage() {
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

  useEffect(() => {
    const syncLogs = () => setLogs(getHardwareLogs());
    syncLogs();
    window.addEventListener("gc-hardware-logs-updated", syncLogs);
    return () => window.removeEventListener("gc-hardware-logs-updated", syncLogs);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
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
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }, []);

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
    };
    setAccounts((prev) => [created, ...prev]);
    setNewAccount({ fullName: "", username: "", email: "", role: "CAISSIER" });
    setAccountMessage("Compte ajouté.");
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

  const hasChanges = currentSnapshot !== lastSavedSnapshot;

  const handleSaveSettings = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, currentSnapshot);
      setLastSavedSnapshot(currentSnapshot);
      setSaveMessage("Informations enregistrées.");
    } catch {
      setSaveMessage("Échec de l'enregistrement local.");
    }
  };

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
            <CardDescription>Ajoutez des comptes Caissier et Admin pour l'application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              {accountMessage ? <p className="text-xs text-slate-500">{accountMessage}</p> : <span />}
              <Button type="button" onClick={addAccount}>
                Ajouter un compte
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[840px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Nom</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Identifiant</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Email</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Rôle</th>
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
                      <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                        Aucun compte ajouté pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

        <div className="flex justify-end pb-2">
          <Button type="button" className="w-full sm:w-auto" onClick={handleSaveSettings} disabled={!hasChanges}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
