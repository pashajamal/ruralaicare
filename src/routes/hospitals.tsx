import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Navigation, Phone } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CLINIC_ORIGIN, distanceKm } from "@/lib/specialty";

export const Route = createFileRoute("/hospitals")({
  head: () => ({
    meta: [
      { title: "Nearby Hospitals | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Nearby hospitals and clinics matched to a case's specialty need, with distance, phone number and directions.",
      },
      { property: "og:title", content: "Nearby Hospitals | AI Virtual Clinic" },
      { property: "og:description", content: "Referral support: closest facility matched to the case category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HospitalsPage,
});

function HospitalsPage() {
  const [specialty, setSpecialty] = useState("All");

  const { data: hospitals } = useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitals").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: redCases } = useQuery({
    queryKey: ["red-cases-referral"],
    queryFn: async () => {
      const { data } = await supabase
        .from("visits")
        .select("id, risk_tier, hospital_specialty_tag, created_at, patients(name, age)")
        .or("risk_tier.eq.RED,referral_required.eq.true")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const specialties = useMemo(() => {
    const set = new Set<string>();
    for (const h of hospitals ?? []) for (const s of (h.specialty_tags as string[]) ?? []) set.add(s);
    return ["All", ...Array.from(set).sort()];
  }, [hospitals]);

  const rows = useMemo(() => {
    return (hospitals ?? [])
      .map((h) => ({
        ...h,
        distance: distanceKm(CLINIC_ORIGIN, { lat: h.latitude, lng: h.longitude }),
      }))
      .filter((h) => specialty === "All" || ((h.specialty_tags as string[]) ?? []).includes(specialty))
      .sort((a, b) => a.distance - b.distance);
  }, [hospitals, specialty]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <MapPin className="size-6 text-primary" aria-hidden /> Nearby hospitals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Facilities near the clinic, sorted by distance and matched to the case's specialty category.
          </p>
        </header>

        {(redCases ?? []).length > 0 ? (
          <section className="rounded-2xl border border-risk-red/30 bg-risk-red-soft p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-risk-red">Cases needing in-person referral</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(redCases ?? []).map((c) => {
                const p = c.patients as { name?: string; age?: number } | null;
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2">
                    <RiskPill tier={c.risk_tier} />
                    <b>{p?.name ?? "Patient"}</b>
                    <span className="text-muted-foreground">{p?.age} yrs</span>
                    <span className="ml-auto text-xs font-semibold">
                      Suggested specialty: {c.hospital_specialty_tag ?? "General Medicine"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSpecialty(c.hospital_specialty_tag ?? "General Medicine")}
                    >
                      Match facilities
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="max-w-xs space-y-2">
          <Label htmlFor="spec">Specialty match</Label>
          <select
            id="spec"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((h) => (
            <article key={h.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">{h.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{h.address}</p>
              <p className="mt-2 text-sm font-medium text-primary">{h.distance.toFixed(1)} km away</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {((h.specialty_tags as string[]) ?? []).map((s) => (
                  <span key={s} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="size-4" aria-hidden /> Get directions
                  </a>
                </Button>
                {h.phone ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${h.phone.replace(/\s/g, "")}`}>
                      <Phone className="size-4" aria-hidden /> {h.phone}
                    </a>
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
