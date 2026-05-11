import { redirect } from "next/navigation";

import DashboardLayoutClient from "./dashboard-layout-client";
import { getSessionUser } from "@/lib/auth/get-session";
import { resolveSessionDisplay } from "@/lib/auth/resolve-session-display";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/connexion");
  }

  const { displayName, pageAccess } = await resolveSessionDisplay(user);

  const initialSessionUser = {
    id: user.id,
    name: displayName,
    email: user.email,
    role: user.sessionRole,
    staffAccountId: user.staffAccountId,
    pageAccess,
    plan: user.plan,
  };

  return (
    <DashboardLayoutClient initialSessionUser={initialSessionUser}>
      {children}
    </DashboardLayoutClient>
  );
}
