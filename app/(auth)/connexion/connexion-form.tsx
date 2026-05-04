"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type ConnexionFormProps = {
  showRegisteredSuccess?: boolean;
};

export function ConnexionForm({ showRegisteredSuccess }: ConnexionFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, null as AuthFormState);

  return (
    <Card className="border-slate-200 shadow-lg shadow-slate-200/60">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white">
          GC
        </div>
        <CardTitle className="text-2xl">Green Clean</CardTitle>
        <CardDescription>Connectez-vous avec votre email et votre mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        {showRegisteredSuccess ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Compte créé avec succès. Entrez votre email et votre mot de passe pour vous connecter.
          </p>
        ) : null}
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {state.error}
            </p>
          ) : null}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="vous@exemple.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={pending}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-emerald-700 underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
