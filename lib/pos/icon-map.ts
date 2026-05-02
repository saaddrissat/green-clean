import {
  Bed,
  Briefcase,
  Footprints,
  type LucideProps,
  Package,
  Shirt,
  Sparkles,
  TowelRack,
} from "lucide-react";
import { createElement, type ComponentType } from "react";

const JoggerPantsIcon = ({ className, ...props }: LucideProps) =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      className,
      ...props,
    },
    createElement("path", {
      d: "M18.16 5V4C18.16 3.057 18.16 2.586 17.86 2.293C17.559 2 17.075 2 16.107 2H7.89298C6.92498 2 6.44098 2 6.13998 2.293C5.83898 2.586 5.83998 3.057 5.83998 4V5M18.16 5L20.815 19.652C21.012 20.742 21.111 21.285 20.803 21.642C20.496 22 19.928 22 18.793 22H17.623C16.893 22 16.527 22 16.255 21.804C15.983 21.609 15.875 21.269 15.661 20.588L13.963 15.213C13.16 12.67 12.758 11.4 12 11.4C11.242 11.4 10.84 12.671 10.037 15.213L8.33998 20.588C8.12498 21.268 8.01798 21.608 7.74598 21.804C7.47398 22 7.10698 22 6.37598 22H5.20698C4.07198 22 3.50398 22 3.19698 21.643C2.88898 21.285 2.98698 20.741 3.18498 19.653L5.83998 5M18.16 5H5.83998",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
    }),
    createElement("path", {
      d: "M10 7.778L12 5L15 10",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );

type CategoryIcon = ComponentType<LucideProps>;

export const categoryIconMap: Record<string, CategoryIcon> = {
  Shirt,
  Package,
  Briefcase,
  Bed,
  Sparkles,
  Shows: Footprints,
  Pants: JoggerPantsIcon,
  Towel: TowelRack,
};

/** Clés stockées en base + libellés français pour l’UI. */
export const categoryIconOptions = [
  { value: "Package", labelFr: "Colis / général" },
  { value: "Shirt", labelFr: "Chemises" },
  { value: "Briefcase", labelFr: "Costumes / mallette" },
  { value: "Bed", labelFr: "Literie" },
  { value: "Sparkles", labelFr: "Robes / textiles délicats" },
  { value: "Shows", labelFr: "Shows (chaussures)" },
  { value: "Pants", labelFr: "Pantalons" },
  { value: "Towel", labelFr: "Serviettes" },
] as const satisfies ReadonlyArray<{ value: string; labelFr: string }>;
