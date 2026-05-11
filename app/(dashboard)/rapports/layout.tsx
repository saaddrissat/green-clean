import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/get-session";
import { demoBlocksRapports } from "@/lib/plan-features";
import { prisma } from "@/lib/prisma";

export default async function RapportsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/connexion");
  }
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { plan: true },
  });
  if (demoBlocksRapports(row?.plan)) {
    redirect("/?restriction=demo-rapports");
  }
  return children;
}
