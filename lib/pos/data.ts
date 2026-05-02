import { Shirt, Sparkles, Package, Bed, Briefcase, type LucideIcon } from "lucide-react";

export type ProductOption = {
  id: string;
  label: string;
  priceModifier: number;
};

export type PosCategory = {
  id: string;
  name: string;
  icon: LucideIcon;
};

export type PosProduct = {
  id: string;
  name: string;
  categoryId: string;
  barcode: string;
  basePrice: number;
  options: ProductOption[];
};

export const posCategories: PosCategory[] = [
  { id: "chemises", name: "Chemises", icon: Shirt },
  { id: "pantalons", name: "Pantalons", icon: Package },
  { id: "costumes", name: "Costumes", icon: Briefcase },
  { id: "linge-maison", name: "Linge Maison", icon: Bed },
  { id: "premium", name: "Premium", icon: Sparkles },
];

export const posProducts: PosProduct[] = [
  {
    id: "prod-chemise-standard",
    name: "Chemise",
    categoryId: "chemises",
    barcode: "GC1001",
    basePrice: 2500,
    options: [
      { id: "lavage-repassage", label: "Lavage + Repassage", priceModifier: 0 },
      { id: "repassage-seul", label: "Repassage seul", priceModifier: -700 },
    ],
  },
  {
    id: "prod-chemise-delicate",
    name: "Chemise delicate",
    categoryId: "chemises",
    barcode: "GC1002",
    basePrice: 3200,
    options: [
      { id: "lavage-main", label: "Lavage main + Repassage", priceModifier: 600 },
      { id: "repassage-seul", label: "Repassage seul", priceModifier: -900 },
    ],
  },
  {
    id: "prod-pantalon-classique",
    name: "Pantalon",
    categoryId: "pantalons",
    barcode: "GC2001",
    basePrice: 2800,
    options: [
      { id: "lavage-repassage", label: "Lavage + Repassage", priceModifier: 0 },
      { id: "repassage-seul", label: "Repassage seul", priceModifier: -600 },
    ],
  },
  {
    id: "prod-jean",
    name: "Jean",
    categoryId: "pantalons",
    barcode: "GC2002",
    basePrice: 3000,
    options: [
      { id: "lavage-repassage", label: "Lavage + Repassage", priceModifier: 0 },
      { id: "lavage-seul", label: "Lavage seul", priceModifier: -500 },
    ],
  },
  {
    id: "prod-costume-2p",
    name: "Costume 2 pieces",
    categoryId: "costumes",
    barcode: "GC3001",
    basePrice: 8500,
    options: [
      { id: "nettoyage-complet", label: "Nettoyage complet", priceModifier: 0 },
      { id: "vapeur-repassage", label: "Vapeur + Repassage", priceModifier: -2000 },
    ],
  },
  {
    id: "prod-veste",
    name: "Veste",
    categoryId: "costumes",
    barcode: "GC3002",
    basePrice: 5200,
    options: [
      { id: "nettoyage-complet", label: "Nettoyage complet", priceModifier: 0 },
      { id: "repassage-seul", label: "Repassage seul", priceModifier: -1200 },
    ],
  },
  {
    id: "prod-drap",
    name: "Drap",
    categoryId: "linge-maison",
    barcode: "GC4001",
    basePrice: 2200,
    options: [
      { id: "lavage-pliage", label: "Lavage + Pliage", priceModifier: 0 },
      { id: "repassage-seul", label: "Repassage seul", priceModifier: -500 },
    ],
  },
  {
    id: "prod-couette",
    name: "Couette",
    categoryId: "linge-maison",
    barcode: "GC4002",
    basePrice: 9000,
    options: [
      { id: "nettoyage-standard", label: "Nettoyage standard", priceModifier: 0 },
      { id: "desinfection", label: "Desinfection anti-acariens", priceModifier: 1500 },
    ],
  },
  {
    id: "prod-robe-soiree",
    name: "Robe de soiree",
    categoryId: "premium",
    barcode: "GC5001",
    basePrice: 12000,
    options: [
      { id: "premium-complet", label: "Traitement premium complet", priceModifier: 0 },
      { id: "retouche-legere", label: "Retouche legere", priceModifier: 2000 },
    ],
  },
  {
    id: "prod-boubou",
    name: "Boubou",
    categoryId: "premium",
    barcode: "GC5002",
    basePrice: 7000,
    options: [
      { id: "lavage-repassage", label: "Lavage + Repassage", priceModifier: 0 },
      { id: "repassage-seul", label: "Repassage seul", priceModifier: -1500 },
    ],
  },
];
