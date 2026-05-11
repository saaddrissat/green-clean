import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/get-session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  if (!user || user.role !== "SUPERADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Green Clean</p>
          <h1 className="text-lg font-semibold text-slate-900">Back-office SuperAdmin</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline">
          Retour à l&apos;application
        </Link>
      </header>
      {children}
    </div>
  );
}
