import { getDashboardHomeData } from "@/app/actions/dashboard";

import { DashboardHomeClient } from "./dashboard-home-client";

export default async function DashboardHomePage() {
  const data = await getDashboardHomeData();
  return <DashboardHomeClient data={data} />;
}
