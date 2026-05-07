"use server";

import { getSessionUser } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

export type GlobalSearchResult = {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  kind: "page" | "client" | "provider";
};

export async function globalSearchAction(query: string): Promise<GlobalSearchResult[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const [clients, providers] = await Promise.all([
    prisma.client.findMany({
      where: {
        userId: user.id,
        OR: [{ fullName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }],
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, fullName: true, phone: true, email: true },
    }),
    prisma.provider.findMany({
      where: {
        userId: user.id,
        OR: [{ name: { contains: q } }, { phone: { contains: q } }, { category: { contains: q } }],
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, phone: true, category: true },
    }),
  ]);

  const rows: GlobalSearchResult[] = [];
  for (const c of clients) {
    rows.push({
      id: `client-${c.id}`,
      label: c.fullName,
      subtitle: c.phone || c.email || "Client",
      href: `/clients?search=${encodeURIComponent(c.fullName)}`,
      kind: "client",
    });
  }
  for (const p of providers) {
    rows.push({
      id: `provider-${p.id}`,
      label: p.name,
      subtitle: p.phone || p.category || "Fournisseur",
      href: `/portefeuille?search=${encodeURIComponent(p.name)}`,
      kind: "provider",
    });
  }
  return rows;
}
