export const dynamic = "force-dynamic";

import { getClientsAction } from "@/app/actions/pos";

import { ClientsClient } from "./clients-client";

export default async function ClientsPage() {
  let initialClients: Awaited<ReturnType<typeof getClientsAction>> = [];
  try {
    initialClients = await getClientsAction();
  } catch {
    initialClients = [];
  }

  return <ClientsClient initialClients={initialClients} />;
}
