"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

export function PasswordInput({
  className,
  id,
  onChange,
  onInput,
  value,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [hasChar, setHasChar] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;

  const syncFromTarget = (el: HTMLInputElement) => {
    const len = el.value.length;
    setHasChar(len > 0);
    if (len === 0) setVisible(false);
  };

  useEffect(() => {
    if (typeof value === "string") {
      setHasChar(value.length > 0);
      if (value.length === 0) setVisible(false);
    }
  }, [value]);

  return (
    <div className="relative">
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        className={cn(
          "flex min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50",
          hasChar ? "pr-11" : "pr-3",
          className,
        )}
        onChange={(e) => {
          syncFromTarget(e.currentTarget);
          onChange?.(e);
        }}
        onInput={(e) => {
          syncFromTarget(e.currentTarget);
          onInput?.(e);
        }}
        {...(value !== undefined ? { value } : {})}
        {...props}
      />
      {hasChar ? (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      ) : null}
    </div>
  );
}
