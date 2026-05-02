import { getOrdersAction } from "@/app/actions/pos";
import { SuiviClient } from "@/app/(dashboard)/suivi/suivi-client";

export const dynamic = "force-dynamic";

export default async function SuiviPage() {
  let orders = [] as Awaited<ReturnType<typeof getOrdersAction>>;
  try {
    orders = await getOrdersAction();
  } catch {
    // Database can be unavailable during local bootstrap.
  }

  return <SuiviClient initialOrders={orders} />;
}
