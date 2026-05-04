import { ConnexionForm } from "./connexion-form";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const sp = await searchParams;
  const showRegisteredSuccess = sp.registered === "1";

  return <ConnexionForm showRegisteredSuccess={showRegisteredSuccess} />;
}
