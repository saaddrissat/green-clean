import { AccesForm } from "./acces-form";

function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/connexion";
  }
  if (value.startsWith("/acces")) {
    return "/connexion";
  }
  return value;
}

export default async function AccesPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const sp = await searchParams;
  const redirectTo = safeRedirect(sp.redirect);

  return <AccesForm redirectTo={redirectTo} />;
}
