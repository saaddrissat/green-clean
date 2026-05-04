/**
 * Same values as Prisma `OrderStatus`. Import from here in client components —
 * do not import `@prisma/client` in `"use client"` modules (breaks Turbopack/browser bundle).
 */
export const ORDER_STATUSES = ["RECU", "EN_COURS", "TERMINE", "LIVRE", "ANNULE"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
