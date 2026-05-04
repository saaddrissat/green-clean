"use client";

import { LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_CAISSIER_PAGE_ACCESS,
  FULL_PAGE_ACCESS,
  PAGE_ORDER,
  type PageAccess,
  type PageKey,
} from "@/lib/navigation-page-access";
import { cn } from "@/lib/utils";

type PageAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PageAccess;
  onChange: (next: PageAccess) => void;
  /** Si true (ex. compte Admin), les interrupteurs sont informatifs / désactivés. */
  fullAccess?: boolean;
  title?: string;
};

function ToggleRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
          checked ? "bg-emerald-500" : "bg-slate-300",
          disabled && "pointer-events-none",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked ? "left-5" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function PageAccessDialog({
  open,
  onOpenChange,
  value,
  onChange,
  fullAccess,
  title = "Pages accessibles",
}: PageAccessDialogProps) {
  const setKey = (key: PageKey, next: boolean) => {
    const merged = { ...value, [key]: next };
    if (!Object.values(merged).some(Boolean)) {
      return;
    }
    onChange(merged);
  };

  const applyRecommendedDefaults = () => {
    onChange({ ...DEFAULT_CAISSIER_PAGE_ACCESS });
  };

  const allowAll = () => {
    onChange({ ...FULL_PAGE_ACCESS });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-emerald-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Activez les sections que ce caissier pourra ouvrir dans le menu. Par défaut : Caisse, Suivi et
            Clients.
          </DialogDescription>
        </DialogHeader>

        {fullAccess ? (
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Les comptes administrateur ont accès à toutes les pages.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={applyRecommendedDefaults}>
                Pages recommandées (Caisse, Suivi, Clients)
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={allowAll}>
                Tout autoriser
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAGE_ORDER.map(({ key, label }) => (
                <ToggleRow
                  key={key}
                  label={label}
                  checked={value[key]}
                  onCheckedChange={(next) => setKey(key, next)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
