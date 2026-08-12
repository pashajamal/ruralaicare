import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const PRESENCE_CHANNEL = "clinic-presence";

type PresenceRow = { user_id: string; name: string; role: string };

/** Tracks the signed-in user in a shared presence channel and reports who else is online. */
export function useClinicPresence() {
  const { profile, role, session } = useAuth();
  const [online, setOnline] = useState<PresenceRow[]>([]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, { config: { presence: { key: userId } } });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceRow>();
        setOnline(Object.values(state).flat().map((p) => ({ user_id: p.user_id, name: p.name, role: p.role })));
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel.track({
          user_id: userId,
          name: profile?.full_name ?? "Clinic staff",
          role: role ?? "health_worker",
        });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id, profile?.full_name, role]);

  const doctors = online.filter((p) => p.role === "doctor" || p.role === "admin");
  return { online, doctors, doctorOnline: doctors.length > 0 };
}
