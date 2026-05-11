"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateTenantPlanAction } from "@/app/actions/superadmin";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SubscriptionPlan } from "@prisma/client";

export type AdminTenantRow = {
  id: string;
  name: string;
  email: string;
  city: string;
  plan: SubscriptionPlan;
  lastLogin: string | null;
  adminStaffCount: number;
  caissierStaffCount: number;
};

const PLANS: SubscriptionPlan[] = ["DEMO", "STARTER", "PRO", "BUSINESS"];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function AdminTenantsTable({ rows }: { rows: AdminTenantRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onPlanChange = (userId: string, plan: SubscriptionPlan) => {
    setError(null);
    startTransition(() => {
      void updateTenantPlanAction(userId, plan)
        .then(() => {
          router.refresh();
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Mise à jour impossible.");
        });
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>Comptes staff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-slate-900">{row.name}</TableCell>
                <TableCell className="text-slate-600">{row.email}</TableCell>
                <TableCell>{row.city}</TableCell>
                <TableCell>
                  <select
                    className="min-h-10 w-full max-w-[11rem] rounded-xl border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-500"
                    value={row.plan}
                    disabled={pending}
                    aria-label={`Plan pour ${row.email}`}
                    onChange={(e) => onPlanChange(row.id, e.target.value as SubscriptionPlan)}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">{formatDate(row.lastLogin)}</TableCell>
                <TableCell className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{row.adminStaffCount}</span> admin ·{" "}
                  <span className="font-medium text-slate-800">{row.caissierStaffCount}</span> caisse
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-slate-500">
        Le changement de plan est enregistré immédiatement en base (MongoDB). Les utilisateurs concernés verront les
        nouvelles limites au prochain chargement de page.
      </p>
      <Button type="button" variant="outline" className="md:hidden" onClick={() => router.push("/")}>
        Retour à l&apos;application
      </Button>
    </div>
  );
}
