import Link from "next/link";

import { listCancelledOrdersAuditAction } from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CommandesAnnuleesPage() {
  let rows: Awaited<ReturnType<typeof listCancelledOrdersAuditAction>> = [];
  try {
    rows = await listCancelledOrdersAuditAction();
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Commandes annulées</h1>
          <p className="text-sm text-slate-500">
            Journal d&apos;audit : annulations, auteur, raison et montant perdu.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link href="/notifications">Retour aux notifications</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>Données enregistrées lors de chaque annulation de commande.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">N° commande</th>
                <th className="px-4 py-3 font-semibold">ID commande</th>
                <th className="px-4 py-3 font-semibold">Auteur (compte)</th>
                <th className="px-4 py-3 font-semibold">Raison</th>
                <th className="px-4 py-3 text-right font-semibold">Montant perdu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(row.cancelledAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.orderNumber}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.orderId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.actorId}</td>
                  <td className="px-4 py-3 text-slate-800">{row.reason}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-700">
                    {row.lostAmount.toFixed(0)} DH
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                    Aucune annulation enregistrée.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
