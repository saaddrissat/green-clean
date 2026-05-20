"use client";

import { useActionState } from "react";

import { verifySiteGateAction, type SiteGateFormState } from "@/app/actions/site-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";

type AccesFormProps = {
  redirectTo: string;
};

export function AccesForm({ redirectTo }: AccesFormProps) {
  const [state, formAction, pending] = useActionState(verifySiteGateAction, null as SiteGateFormState);

  return (
    <Card className="border-slate-200 shadow-lg shadow-slate-200/60">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white">
          GC
        </div>
        <CardTitle className="text-2xl">Accès à l&apos;application</CardTitle>
        <CardDescription>
          Saisissez le code d&apos;accès pour continuer vers la connexion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          {state?.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {state.error}
            </p>
          ) : null}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Code d&apos;accès
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="off"
              required
              placeholder="•••••••••"
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={pending}>
            {pending ? "Vérification…" : "Entrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
