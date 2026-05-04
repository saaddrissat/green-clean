import type { Metadata } from "next";
import { Suspense } from "react";

import { InscriptionForm } from "./inscription-form";

export const metadata: Metadata = {
  title: "Inscription · Green Clean",
};

function InscriptionFallback() {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      aria-busy
      aria-label="Chargement du formulaire"
    >
      <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mx-auto mb-2 h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="mx-auto mb-8 h-4 w-64 animate-pulse rounded bg-slate-100" />
      <div className="space-y-4">
        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function InscriptionPage() {
  return (
    <Suspense fallback={<InscriptionFallback />}>
      <InscriptionForm />
    </Suspense>
  );
}
