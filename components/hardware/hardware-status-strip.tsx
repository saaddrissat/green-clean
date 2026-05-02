"use client";

import { Button } from "@/components/ui/button";
import { useEscPosPrinter } from "@/hooks/use-esc-pos-printer";

/**
 * État imprimante USB + rappel scanner (le scan est géré sur la page Caisse).
 */
export function HardwareStatusStrip() {
  const printer = useEscPosPrinter();

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-600 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <span className="font-medium text-slate-700">
        Scanner code-barres : utilisé sur la page <strong className="text-slate-900">Caisse</strong> uniquement.
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">
          <span className={`h-2 w-2 rounded-full ${printer.isConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
          <span>Imprimante {printer.isConnected ? "OK" : "hors ligne"}</span>
        </div>
        {!printer.isConnected ? (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={printer.connect} disabled={printer.isConnecting}>
            {printer.isConnecting ? "Connexion..." : "Connecter"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
