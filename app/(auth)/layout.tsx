import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion · Green Clean",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-dvh bg-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(14,165,233,0.12),_transparent_45%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
