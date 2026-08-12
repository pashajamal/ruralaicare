import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type Role = "health_worker" | "doctor" | "admin";

export type Profile = {
  id: string;
  full_name: string;
  health_centre: string;
  ui_language: string;
  preferred_patient_language: string;
  notify_red: boolean;
  notify_consultation: boolean;
  notify_followup: boolean;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  isDoctor: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  profile: null,
  role: null,
  isDoctor: false,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  async function loadAccount(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setRole(null);
      return;
    }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, health_centre, ui_language, preferred_patient_language, notify_red, notify_consultation, notify_followup")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as Profile) ?? null);
    const list = (roles ?? []).map((r) => r.role as Role);
    setRole(list.includes("doctor") ? "doctor" : list.includes("admin") ? "admin" : list[0] ?? null);
  }

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION")
        return;
      setSession(next);
      void loadAccount(next?.user?.id).finally(() => setLoading(false));
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadAccount(data.session?.user?.id).finally(() => setLoading(false));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      role,
      isDoctor: role === "doctor" || role === "admin",
      refresh: async () => loadAccount(session?.user?.id),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setRole(null);
      },
    }),
    [loading, session, profile, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
