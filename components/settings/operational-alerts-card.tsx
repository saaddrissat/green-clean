"use client";

import { useEffect, useState } from "react";

import { getOperationalPreferencesAction, updateOperationalPreferencesAction } from "@/app/actions/user-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OperationalAlertsCard() {
  const [closingTime, setClosingTime] = useState("");
  const [ratioPercent, setRatioPercent] = useState(40);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await getOperationalPreferencesAction();
        if (!cancelled) {
          setClosingTime(prefs.storeClosingTime ?? "");
          setRatioPercent(Math.round((prefs.expenseAlertRatio ?? 0.4) * 100));
        }
      } catch {
        if (!cancelled) setMessage({ ok: false, text: "Impossible de charger les préférences." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      await updateOperationalPreferencesAction({
        storeClosingTime: closingTime.trim() || null,
        expenseAlertRatio: Math.min(95, Math.max(5, ratioPercent)) / 100,
      });
      setMessage({ ok: true, text: "Alertes opérationnelles enregistrées." });
      window.dispatchEvent(new CustomEvent("gc-notifications-updated"));
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : "Enregistrement impossible.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertes opérationnelles</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="section-alertes-operationnelles" className="scroll-mt-4">
      <CardHeader>
        <CardTitle>Alertes opérationnelles</CardTitle>
        <CardDescription>
          Heure de fermeture pour le rappel de clôture de caisse, et seuil du ratio dépenses / revenus pour les insights
          « smart ».
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Heure de fermeture boutique</span>
          <input
            type="time"
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3"
            value={closingTime}
            onChange={(e) => setClosingTime(e.target.value)}
          />
          <span className="text-xs text-slate-500">
            Après cette heure, une notification peut rappeler de valider la clôture si ce n&apos;est pas fait.
          </span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Seuil alerte dépenses / CA du jour (%)</span>
          <input
            type="number"
            min={5}
            max={95}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3"
            value={ratioPercent}
            onChange={(e) => setRatioPercent(Number(e.target.value))}
          />
          <span className="text-xs text-slate-500">
            Au-delà de ce pourcentage, une notification insight est proposée (ex. 40 = 40%).
          </span>
        </label>
        {message ? (
          <p className={`text-sm md:col-span-2 ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
        ) : null}
        <div className="md:col-span-2">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer les alertes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
