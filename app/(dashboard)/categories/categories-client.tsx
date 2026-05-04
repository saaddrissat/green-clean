"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  archiveCategoryAction,
  archiveProductAction,
  createCategoryAction,
  createProductAction,
  updateCategoryAction,
  updateProductAction,
} from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryIconMap, categoryIconOptions } from "@/lib/pos/icon-map";

export type CatalogCategory = {
  id: string;
  name: string;
  icon: string;
  products: Array<{
    id: string;
    name: string;
    barcode: string;
    imageUrl?: string | null;
    basePrice: number;
    options: Array<{ id: string; label: string; priceModifier: number }>;
  }>;
};

type CategoriesClientProps = {
  initialCategories: CatalogCategory[];
  dataError?: string;
};

export function CategoriesClient({ initialCategories, dataError }: CategoriesClientProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("Package");
  const [newCategoryIconField, setNewCategoryIconField] = useState("Package");

  const selectNewCategoryIcon = (value: string) => {
    if (!categoryIconMap[value]) return;
    setNewCategoryIcon(value);
    setNewCategoryIconField(value);
  };

  const [newItemCategoryId, setNewItemCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemOptionLabel, setNewItemOptionLabel] = useState("Lavage + Repassage");

  useEffect(() => {
    if (!newItemCategoryId && categories[0]?.id) {
      setNewItemCategoryId(categories[0].id);
    }
  }, [categories, newItemCategoryId]);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryIcon, setEditingCategoryIcon] = useState("Package");
  const [editingCategoryIconField, setEditingCategoryIconField] = useState("Package");

  const selectEditCategoryIcon = (value: string) => {
    if (!categoryIconMap[value]) return;
    setEditingCategoryIcon(value);
    setEditingCategoryIconField(value);
  };

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemPrice, setEditingItemPrice] = useState("");

  const grouped = useMemo(() => categories, [categories]);

  const refresh = () => router.refresh();

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setMessage("");
    try {
      await createCategoryAction({
        name: newCategoryName.trim(),
        icon: newCategoryIcon.trim() || "Package",
      });
      setNewCategoryName("");
      setNewCategoryIcon("Package");
      setNewCategoryIconField("Package");
      setMessage("Catégorie ajoutée.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur lors de l’ajout.");
    }
  };

  const handleAddItem = async () => {
    const price = Number(newItemPrice);
    if (!newItemName.trim() || !newItemCategoryId || !Number.isFinite(price) || price <= 0) {
      setMessage("Remplissez nom, catégorie et un prix valide.");
      return;
    }
    const optionLabel = newItemOptionLabel.trim() || "Lavage + Repassage";
    setMessage("");
    try {
      await createProductAction({
        name: newItemName.trim(),
        basePrice: price,
        categoryId: newItemCategoryId,
        optionLabel,
      });
      setNewItemName("");
      setNewItemPrice("");
      setNewItemOptionLabel("Lavage + Repassage");
      setMessage("Article ajouté.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur lors de l’ajout.");
    }
  };

  const startEditCategory = (category: CatalogCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryIcon(category.icon);
    setEditingCategoryIconField(category.icon);
  };

  const saveEditCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    setMessage("");
    try {
      await updateCategoryAction({
        id: editingCategoryId,
        name: editingCategoryName.trim(),
        icon: editingCategoryIcon.trim() || "Package",
      });
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setEditingCategoryIcon("Package");
      setEditingCategoryIconField("Package");
      setMessage("Catégorie mise à jour.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur modification.");
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm("Retirer cette catégorie et ses articles du catalogue ?")) return;
    setMessage("");
    try {
      await archiveCategoryAction(categoryId);
      if (newItemCategoryId === categoryId) {
        const next = categories.find((c) => c.id !== categoryId);
        setNewItemCategoryId(next?.id ?? "");
      }
      setMessage("Catégorie retirée du catalogue.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur suppression.");
    }
  };

  const startEditItem = (item: CatalogCategory["products"][number]) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setEditingItemPrice(String(item.basePrice));
  };

  const saveEditItem = async () => {
    const parsedPrice = Number(editingItemPrice);
    if (!editingItemId || !editingItemName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) return;
    setMessage("");
    try {
      await updateProductAction({
        id: editingItemId,
        name: editingItemName.trim(),
        basePrice: parsedPrice,
      });
      setEditingItemId(null);
      setEditingItemName("");
      setEditingItemPrice("");
      setMessage("Article mis à jour.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur modification.");
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Retirer cet article du catalogue ?")) return;
    setMessage("");
    try {
      await archiveProductAction(itemId);
      setMessage("Article retiré du catalogue.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur suppression.");
    }
  };

  const disabled = Boolean(dataError);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Catégories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez les catégories et les articles (même catalogue que la caisse).
        </p>
      </section>

      {dataError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Base de données inaccessible : {dataError}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{message}</p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouvelle catégorie</CardTitle>
            <CardDescription>Créez une catégorie de services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nom de la catégorie"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              disabled={disabled}
            />
            <div className="space-y-1.5">
              <label htmlFor="cat-new-icon" className="text-xs font-medium text-slate-600">
                Icône
              </label>
              <input
                id="cat-new-icon"
                name="categorieIcone"
                list="liste-icones-categorie-page"
                autoComplete="off"
                value={newCategoryIconField}
                onChange={(event) => {
                  const next = event.target.value;
                  setNewCategoryIconField(next);
                  if (categoryIconMap[next]) {
                    setNewCategoryIcon(next);
                  }
                }}
                onBlur={() => {
                  if (!categoryIconMap[newCategoryIconField]) {
                    setNewCategoryIconField(newCategoryIcon);
                  }
                }}
                placeholder="Clé technique ou liste (Package, Shirt…)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={disabled}
              />
              <datalist id="liste-icones-categorie-page">
                {categoryIconOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelFr}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-slate-500">
                Sélection rapide : cliquez une icône ou saisissez la clé technique (Package, Shirt…).
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {categoryIconOptions.map((opt) => {
                  const Icon = categoryIconMap[opt.value] ?? categoryIconMap.Package;
                  const selected = newCategoryIcon === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.labelFr}
                      aria-label={opt.labelFr}
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => selectNewCategoryIcon(opt.value)}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border text-slate-700 transition disabled:opacity-50 ${
                        selected
                          ? "border-sky-500 bg-sky-100 text-sky-900 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>
            <Button type="button" onClick={handleAddCategory} disabled={disabled}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter la catégorie
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouvel article</CardTitle>
            <CardDescription>Ajoutez un article dans une catégorie existante.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={newItemCategoryId}
              onChange={(event) => setNewItemCategoryId(event.target.value)}
              disabled={disabled}
            >
              <option value="">Choisir une catégorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nom de l’article"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              disabled={disabled}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="Prix de base (DHs)"
              value={newItemPrice}
              onChange={(event) => setNewItemPrice(event.target.value)}
              disabled={disabled}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Libellé de l’option (ex. Lavage + Repassage)"
              value={newItemOptionLabel}
              onChange={(event) => setNewItemOptionLabel(event.target.value)}
              disabled={disabled}
            />
            <Button type="button" onClick={handleAddItem} disabled={disabled}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter l’article
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        {grouped.map((category) => {
          const CategoryTitleIcon = categoryIconMap[category.icon] ?? categoryIconMap.Package;
          return (
          <Card key={category.id}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {editingCategoryId === category.id ? (
                  <div className="flex flex-col gap-3">
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={editingCategoryName}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                      disabled={disabled}
                    />
                    <input
                      id={`edit-icon-${category.id}`}
                      list="liste-icones-categorie-page"
                      autoComplete="off"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={editingCategoryIconField}
                      onChange={(event) => {
                        const next = event.target.value;
                        setEditingCategoryIconField(next);
                        if (categoryIconMap[next]) {
                          setEditingCategoryIcon(next);
                        }
                      }}
                      onBlur={() => {
                        if (!categoryIconMap[editingCategoryIconField]) {
                          setEditingCategoryIconField(editingCategoryIcon);
                        }
                      }}
                      placeholder="Icône (Package, Shirt…)"
                      disabled={disabled}
                    />
                    <div className="flex flex-wrap gap-2">
                      {categoryIconOptions.map((opt) => {
                        const Icon = categoryIconMap[opt.value] ?? categoryIconMap.Package;
                        const selected = editingCategoryIcon === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.labelFr}
                            aria-pressed={selected}
                            disabled={disabled}
                            onClick={() => selectEditCategoryIcon(opt.value)}
                            className={`flex h-10 w-10 items-center justify-center rounded-lg border text-slate-700 transition disabled:opacity-50 ${
                              selected
                                ? "border-sky-500 bg-sky-100 text-sky-900"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <CategoryTitleIcon className="h-8 w-8 shrink-0 text-slate-700" />
                    <span>
                      {category.name}{" "}
                      <span className="text-sm font-normal text-slate-500">({category.icon})</span>
                    </span>
                  </CardTitle>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editingCategoryId === category.id ? (
                  <Button type="button" size="sm" onClick={saveEditCategory} disabled={disabled}>
                    Enregistrer
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEditCategory(category)}
                    disabled={disabled}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => deleteCategory(category.id)}
                  disabled={disabled}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Article</th>
                    <th className="px-4 py-3 font-semibold">Prix</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {category.products.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        {editingItemId === item.id ? (
                          <input
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={editingItemName}
                            onChange={(event) => setEditingItemName(event.target.value)}
                            disabled={disabled}
                          />
                        ) : (
                          <div>
                            <div>{item.name}</div>
                            {item.options[0] ? (
                              <div className="text-xs text-slate-500">{item.options[0].label}</div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingItemId === item.id ? (
                          <input
                            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingItemPrice}
                            onChange={(event) => setEditingItemPrice(event.target.value)}
                            disabled={disabled}
                          />
                        ) : (
                          `${item.basePrice} DHs`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {editingItemId === item.id ? (
                            <Button type="button" size="sm" onClick={saveEditItem} disabled={disabled}>
                              Enregistrer
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => startEditItem(item)}
                              disabled={disabled}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => deleteItem(item.id)}
                            disabled={disabled}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {category.products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={3}>
                        Aucun article dans cette catégorie.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
          );
        })}
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500">
              {dataError ? "Impossible de charger les catégories." : "Aucune catégorie pour le moment."}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
