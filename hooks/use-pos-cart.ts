"use client";

import { create } from "zustand";
import { formatMoney } from "@/lib/currency";

export type ProductOptionLike = {
  id: string;
  label: string;
  priceModifier: number;
};

export type PosProductLike = {
  id: string;
  name: string;
  barcode: string;
  basePrice: number;
  options: ProductOptionLike[];
};

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  optionId: string;
  optionLabel: string;
  unitPrice: number;
  quantity: number;
};

type AddToCartInput = {
  product: PosProductLike;
  option: ProductOptionLike;
};

type PosCartState = {
  items: CartItem[];
  addItem: (input: AddToCartInput) => void;
  addByBarcode: (barcode: string, products: PosProductLike[]) => { found: boolean; productName?: string };
  incrementItem: (id: string) => void;
  decrementItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

export const formatXof = (amount: number) =>
  formatMoney(amount);

export const usePosCart = create<PosCartState>((set) => ({
  items: [],
  addItem: ({ product, option }) => {
    const unitPrice = Math.max(0, product.basePrice + option.priceModifier);
    set((state) => {
      const existing = state.items.find(
        (item) => item.productId === product.id && item.optionId === option.id,
      );

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            id: `${product.id}:${option.id}`,
            productId: product.id,
            productName: product.name,
            optionId: option.id,
            optionLabel: option.label,
            unitPrice,
            quantity: 1,
          },
        ],
      };
    });
  },
  addByBarcode: (barcode, products) => {
    const product = products.find((entry) => entry.barcode.toLowerCase() === barcode.toLowerCase());
    if (!product) {
      return { found: false };
    }

    const fallbackOption = product.options[0];
    if (!fallbackOption) {
      return { found: false };
    }

    set((state) => {
      const existing = state.items.find(
        (item) => item.productId === product.id && item.optionId === fallbackOption.id,
      );

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            id: `${product.id}:${fallbackOption.id}`,
            productId: product.id,
            productName: product.name,
            optionId: fallbackOption.id,
            optionLabel: fallbackOption.label,
            unitPrice: Math.max(0, product.basePrice + fallbackOption.priceModifier),
            quantity: 1,
          },
        ],
      };
    });

    return { found: true, productName: product.name };
  },
  incrementItem: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, quantity: item.quantity + 1 } : item)),
    })),
  decrementItem: (id) =>
    set((state) => ({
      items: state.items
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item))
        .filter((item) => item.quantity > 0),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clearCart: () => set({ items: [] }),
}));
