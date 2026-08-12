import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { MapPin, Navigation, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CLINIC_ORIGIN, distanceKm, mapsDirectionsUrl } from "@/lib/specialty";

/** Specialty-matched facility shortlist shown on emergency (RED) cases. */
export function ReferralHospitals({
  specialty,
  onChoose,
  chosen,
}: {
  specialty: string;
  onChoose?: (name: string) => void;
  chosen?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitals").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const all = (data ?? []).map((h) => ({
      ...h,
      tags: ((h.specialty_tags as string[]) ?? []),
      distance: distanceKm(CLINIC_ORIGIN, { lat: h.latitude, lng: h.longitude }),
    }));
    const matched = all.filter((h) => h.tags.includes(specialty));
    const rest = all.filter((h) => !h.tags.includes(specialty));
    return [...matched.sort((a, b) => a.distance - b.distance), ...rest.sort((a, b) => a.distance - b.distance)].slice(
      0,
      3,
    );
  }, [data, specialty]);

  return (
    <div className="mt-5 rounded-xl border border-risk-red/30 bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-risk-red">
        <MapPin className="size-4" aria-hidden /> Nearest facilities for {specialty}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Matched on the case's specialty category, then sorted by distance from the health centre.
      </p>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading facilities…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No facilities on file yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((h) => (
            <li key={h.id} className="rounded-xl border border-border bg-secondary p-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{h.name}</b>
                {h.tags.includes(specialty) ? (
                  <span className="rounded-full bg-risk-red-soft px-2 py-0.5 text-xs font-semibold text-risk-red">
                    {specialty}
                  </span>
                ) : null}
                <span className="ml-auto text-xs font-semibold text-primary">{h.distance.toFixed(1)} km</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{h.address}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={mapsDirectionsUrl(h.latitude, h.longitude)} target="_blank" rel="noreferrer">
                    <Navigation className="size-4" aria-hidden /> Directions
                  </a>
                </Button>
                {h.phone ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${h.phone.replace(/\s/g, "")}`}>
                      <Phone className="size-4" aria-hidden /> {h.phone}
                    </a>
                  </Button>
                ) : null}
                {onChoose ? (
                  <Button
                    size="sm"
                    variant={chosen === h.name ? "secondary" : "outline"}
                    onClick={() => onChoose(h.name)}
                  >
                    {chosen === h.name ? "Selected as receiving facility" : "Use as receiving facility"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}