import { getClientsAction, getPosCatalogAction } from "@/app/actions/pos";
import { CaisseClient } from "@/app/(dashboard)/caisse/caisse-client";

export const dynamic = "force-dynamic";

export default async function CaissePage() {
  let categories = [] as Awaited<ReturnType<typeof getPosCatalogAction>>;
  let clients = [] as Awaited<ReturnType<typeof getClientsAction>>;
  let dataError = "";
  try {
    [categories, clients] = await Promise.all([getPosCatalogAction(), getClientsAction()]);
  } catch (error) {
    dataError =
      error instanceof Error
        ? error.message
        : "Connexion base de donnees impossible.";
  }
  return <CaisseClient categories={categories} clients={clients} dataError={dataError} />;
}
