"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  hasAlert?: boolean;
};

type AppSidebarProps = {
  title: string;
  items: SidebarItem[];
  currentUserName?: string;
  currentUserRole?: string;
  /** Narrow rail with icons only (labels in native tooltip). */
  variant?: "default" | "icon-only";
};

export function AppSidebar({
  title,
  items,
  currentUserName = "Utilisateur actuel",
  currentUserRole = "Admin",
  variant = "default",
}: AppSidebarProps) {
  const pathname = usePathname();
  const iconOnly = variant === "icon-only";
  const initials = currentUserName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col bg-slate-950 text-slate-100",
        iconOnly && "items-stretch",
      )}
    >
      <div
        className={cn(
          "border-b border-slate-800",
          iconOnly ? "flex justify-center p-3" : "p-5",
        )}
      >
        {iconOnly ? (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-sm font-bold text-white"
            title={title}
          >
            GC
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Green Clean</p>
            <h2 className="mt-2 text-lg font-semibold">{title}</h2>
          </>
        )}
      </div>
      <nav className={cn("flex-1 space-y-2", iconOnly ? "flex flex-col items-center p-2" : "p-4")}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "relative flex items-center rounded-2xl font-medium transition-colors",
                iconOnly ? "h-12 w-12 justify-center" : "min-h-14 justify-start gap-3 px-4 text-base",
                isActive
                  ? "bg-sky-600 text-white"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.hasAlert ? (
                <span
                  className={cn(
                    "absolute inline-flex h-2.5 w-2.5 rounded-full bg-rose-500",
                    iconOnly ? "right-3 top-3" : "right-4 top-4",
                  )}
                  aria-hidden
                />
              ) : null}
              {!iconOnly ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "border-t border-slate-800",
          iconOnly ? "flex justify-center p-2" : "p-3",
        )}
      >
        <div
          className={cn(
            "flex items-center rounded-xl bg-slate-900/80 text-slate-100",
            iconOnly ? "h-12 w-12 justify-center" : "gap-3 px-3 py-2",
          )}
          title={`${currentUserName} - ${currentUserRole}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
            {initials || "U"}
          </div>
          {!iconOnly ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentUserName}</p>
              <p className="truncate text-xs text-slate-400">{currentUserRole}</p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
