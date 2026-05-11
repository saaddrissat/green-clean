import { redirect } from "next/navigation";

import { AdminTenantsTable, type AdminTenantRow } from "./admin-tenants-table";
import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

export default async function SuperAdminDashboardPage() {
  const me = await getSessionUser();
  if (!me || me.role !== "SUPERADMIN") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      plan: true,
      lastLogin: true,
      staffAccounts: { select: { role: true } },
    },
  });

  const rows: AdminTenantRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    city: u.city,
    plan: u.plan,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    adminStaffCount: u.staffAccounts.filter((s) => s.role === "ADMIN").length,
    caissierStaffCount: u.staffAccounts.filter((s) => s.role === "CAISSIER").length,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Tenants</h2>
        <p className="mt-1 text-sm text-slate-600">
          Liste des comptes blanchisserie : plans, dernière connexion titulaire, et sous-comptes staff (admin / caisse).
        </p>
      </div>
      <AdminTenantsTable rows={rows} />
    </main>
  );
}
