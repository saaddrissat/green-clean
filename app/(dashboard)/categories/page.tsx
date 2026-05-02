"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceCategory = {
  id: string;
  name: string;
  icon: string;
};

type ServiceItem = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
};

const initialCategories: ServiceCategory[] = [
  { id: "cat-shirts", name: "Chemises", icon: "Shirt" },
  { id: "cat-dresses", name: "Robes", icon: "Sparkles" },
  { id: "cat-pants", name: "Pantalons", icon: "Package" },
];

const initialItems: ServiceItem[] = [
  { id: "it-1", categoryId: "cat-shirts", name: "Chemise simple", price: 35 },
  { id: "it-2", categoryId: "cat-shirts", name: "Chemise premium", price: 45 },
  { id: "it-3", categoryId: "cat-dresses", name: "Robe soirée", price: 80 },
  { id: "it-4", categoryId: "cat-pants", name: "Pantalon classique", price: 40 },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("Package");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryIcon, setEditingCategoryIcon] = useState("Package");

  const [newItemCategoryId, setNewItemCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemPrice, setEditingItemPrice] = useState("");

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const grouped = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.categoryId === category.id),
    }));
  }, [categories, items]);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const next: ServiceCategory = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      icon: newCategoryIcon.trim() || "Package",
    };
    setCategories((prev) => [...prev, next]);
    setNewCategoryName("");
    setNewCategoryIcon("Package");
    if (!newItemCategoryId) {
      setNewItemCategoryId(next.id);
    }
  };

  const startEditCategory = (category: ServiceCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryIcon(category.icon);
  };

  const saveEditCategory = () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    setCategories((prev) =>
      prev.map((category) =>
        category.id === editingCategoryId
          ? { ...category, name: editingCategoryName.trim(), icon: editingCategoryIcon.trim() || "Package" }
          : category,
      ),
    );
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryIcon("Package");
  };

  const deleteCategory = (categoryId: string) => {
    setCategories((prev) => prev.filter((category) => category.id !== categoryId));
    setItems((prev) => prev.filter((item) => item.categoryId !== categoryId));
    if (newItemCategoryId === categoryId) {
      const next = categories.find((category) => category.id !== categoryId);
      setNewItemCategoryId(next?.id ?? "");
    }
  };

  const handleAddItem = () => {
    const price = Number(newItemPrice);
    if (!newItemName.trim() || !newItemCategoryId || !Number.isFinite(price) || price <= 0) return;
    const next: ServiceItem = {
      id: `it-${Date.now()}`,
      categoryId: newItemCategoryId,
      name: newItemName.trim(),
      price,
    };
    setItems((prev) => [...prev, next]);
    setNewItemName("");
    setNewItemPrice("");
  };

  const startEditItem = (item: ServiceItem) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setEditingItemPrice(String(item.price));
  };

  const saveEditItem = () => {
    const parsedPrice = Number(editingItemPrice);
    if (!editingItemId || !editingItemName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === editingItemId ? { ...item, name: editingItemName.trim(), price: parsedPrice } : item,
      ),
    );
    setEditingItemId(null);
    setEditingItemName("");
    setEditingItemPrice("");
  };

  const deleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Catégories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez les catégories et les articles de vos services (ajout, modification, suppression).
        </p>
      </section>

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
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Icône (ex: Package, Shirt)"
              value={newCategoryIcon}
              onChange={(event) => setNewCategoryIcon(event.target.value)}
            />
            <Button type="button" onClick={handleAddCategory}>
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
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="number"
              min="0"
              placeholder="Prix"
              value={newItemPrice}
              onChange={(event) => setNewItemPrice(event.target.value)}
            />
            <Button type="button" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter l’article
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        {grouped.map((category) => (
          <Card key={category.id}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editingCategoryId === category.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={editingCategoryName}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                    />
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={editingCategoryIcon}
                      onChange={(event) => setEditingCategoryIcon(event.target.value)}
                    />
                  </div>
                ) : (
                  <CardTitle className="text-lg">
                    {category.name} <span className="text-sm font-normal text-slate-500">({category.icon})</span>
                  </CardTitle>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingCategoryId === category.id ? (
                  <Button type="button" size="sm" onClick={saveEditCategory}>
                    Enregistrer
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => startEditCategory(category)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => deleteCategory(category.id)}>
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
                  {category.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        {editingItemId === item.id ? (
                          <input
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={editingItemName}
                            onChange={(event) => setEditingItemName(event.target.value)}
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingItemId === item.id ? (
                          <input
                            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            type="number"
                            min="0"
                            value={editingItemPrice}
                            onChange={(event) => setEditingItemPrice(event.target.value)}
                          />
                        ) : (
                          `${item.price} DHs`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {editingItemId === item.id ? (
                            <Button type="button" size="sm" onClick={saveEditItem}>
                              Enregistrer
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="outline" onClick={() => startEditItem(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => deleteItem(item.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {category.items.length === 0 ? (
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
        ))}
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500">Aucune catégorie pour le moment.</CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
