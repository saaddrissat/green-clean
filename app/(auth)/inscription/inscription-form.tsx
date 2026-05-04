"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function InscriptionForm() {
  const [state, formAction, pending] = useActionState(registerAction, null as AuthFormState);

  return (
    <Card className="border-slate-200 shadow-lg shadow-slate-200/60">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white">
          GC
        </div>
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>Renseignez les informations de votre entreprise.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {state.error}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">
                Nom complet
              </label>
              <Input id="name" name="name" autoComplete="name" required placeholder="Prénom Nom" />
            </div>
            <div className="space-y-2 sm:col-span-2">
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
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Au moins 8 caractères"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                Téléphone
              </label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" required placeholder="+212 …" />
            </div>
            <div className="space-y-2">
              <label htmlFor="city" className="text-sm font-medium text-slate-700">
                Ville
              </label>
              <Input id="city" name="city" autoComplete="address-level2" required placeholder="Casablanca" />
            </div>
            <div className="space-y-2">
              <label htmlFor="employeeCount" className="text-sm font-medium text-slate-700">
                Nombre d&apos;employés
              </label>
              <Input id="employeeCount" name="employeeCount" type="number" min={0} defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="laundryCount" className="text-sm font-medium text-slate-700">
                Nombre de locales
              </label>
              <Input id="laundryCount" name="laundryCount" type="number" min={1} defaultValue={1} required />
            </div>
          </div>
          <Button type="submit" className="h-12 w-full" disabled={pending}>
            {pending ? "Création…" : "Créer mon compte"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-semibold text-emerald-700 underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
