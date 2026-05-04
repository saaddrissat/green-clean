import { getPosCatalogAction } from "@/app/actions/pos";

import { CategoriesClient } from "./categories-client";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof getPosCatalogAction>> = [];
  let dataError = "";
  try {
    categories = await getPosCatalogAction();
  } catch (error) {
    dataError =
      error instanceof Error ? error.message : "Connexion base de donnees impossible.";
  }
  return <CategoriesClient initialCategories={categories} dataError={dataError} />;
}
