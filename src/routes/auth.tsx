import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { bootstrapAccount } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth";

function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = safeNext(s['next']);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Staff Sign In | AI Virtual Clinic" },
      {
        name: "description",
        content: "Sign in as a rural health worker or reviewing doctor to access the AI-assisted clinical workflow.",
      },
      { property: "og:title", content: "Staff Sign In | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "Role-aware access for health workers and doctors. Patient records are never public.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { session, refresh } = useAuth();

  function goNext() {
    if (next) {
      window.location.href = next;
      return;
    }
    void navigate({ to: "/" });
  }
  const bootstrap = useServerFn(bootstrapAccount);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<"health_worker" | "doctor">("health_worker");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, next]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const centre = String(form.get("health_centre") ?? "Rampur Health Centre").trim();

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.success("Check your email to confirm the account, then sign in.");
        return;
      }

      await bootstrap({
        data: {
          full_name: fullName || email.split("@")[0] || "Staff",
          role,
          health_centre: centre || "Rampur Health Centre",
        },
      });
      await refresh();
      toast.success("Signed in");
      goNext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: next ? `${window.location.origin}${next}` : window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    await bootstrap({ data: { full_name: "", role, health_centre: "Rampur Health Centre" } });
    await refresh();
    goNext();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">AI Virtual Clinic</h1>
            <p className="text-xs text-muted-foreground">AI-assisted clinical workflow for rural health workers</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">I am signing in as</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "health_worker", label: "Health Worker" },
                    { value: "doctor", label: "Doctor" },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium ${
                      role === option.value ? "border-primary bg-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={role === option.value}
                      onChange={() => setRole(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                New accounts always start with health worker access. Doctor access is granted by an administrator
                after verification — it can never be self-assigned at signup.
              </p>
            </fieldset>

            {mode === "signup" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" name="full_name" placeholder="Dr. A. Sharma" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="health_centre">Health centre</Label>
                  <Input id="health_centre" name="health_centre" defaultValue="Rampur Health Centre" />
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Patient records are restricted to signed-in staff. AI helps organize and prioritize; doctors make the
          decision.
        </p>
      </div>
    </main>
  );
}
