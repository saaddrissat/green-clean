import { redirect } from "next/navigation";

import { ConnexionForm } from "./connexion-form";
import { getSessionUser } from "@/lib/auth/get-session";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === "SUPERADMIN" ? "/admin/dashboard" : "/");
  }

  const sp = await searchParams;
  const showRegisteredSuccess = sp.registered === "1";

  return <ConnexionForm showRegisteredSuccess={showRegisteredSuccess} />;
}
