"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="fr">
      <body className="bg-slate-100 text-slate-900">
        <main className="flex min-h-dvh items-center justify-center p-6">
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-rose-100 p-2 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Service temporairement indisponible</h1>
                <p className="text-sm text-slate-600">
                  Une erreur est survenue (base de donnees ou service interne).
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {error.message || "Erreur inconnue"}
            </div>

            <Button onClick={reset} className="mt-4 w-full min-h-12">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reessayer
            </Button>
          </section>
        </main>
      </body>
    </html>
  );
}
