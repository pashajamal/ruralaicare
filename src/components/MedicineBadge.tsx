import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, PackageX } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export type StockRow = { id: string; medicine_name: string; quantity: number; expiry_date: string | null };

export function useMedicineInventory() {
  return useQuery({
    queryKey: ["medicine-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicine_inventory")
        .select("id, medicine_name, quantity, expiry_date")
        .order("medicine_name");
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
    staleTime: 60_000,
  });
}

/** True when the clinic holds usable, unexpired stock of a medicine. */
export function findStock(rows: StockRow[], medicine: string): StockRow | null {
  const needle = medicine.toLowerCase().replace(/\s*\d+\s*(mg|ml|g)\b.*/i, "").trim();
  if (!needle) return null;
  const match = rows.find((r) => {
    const name = r.medicine_name.toLowerCase();
    return name.includes(needle) || needle.includes(name.replace(/\s*\d+\s*(mg|ml|g)\b.*/i, "").trim());
  });
  if (!match) return null;
  const expired = match.expiry_date ? new Date(match.expiry_date) < new Date() : false;
  return match.quantity > 0 && !expired ? match : null;
}

/** Inline live availability badge shown next to any suggested medicine name. */
export function MedicineBadge({ medicine }: { medicine: string }) {
  const { data, isLoading } = useMedicineInventory();
  if (isLoading || !data) return null;
  const inStock = findStock(data, medicine);

  if (inStock) {
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-risk-green/30 bg-risk-green-soft px-2 py-0.5 text-[11px] font-semibold text-risk-green align-middle">
        <CheckCircle2 className="size-3" aria-hidden /> In Stock ({inStock.quantity})
      </span>
    );
  }
  return (
    <Link
      to="/hospitals"
      className="ml-2 inline-flex items-center gap-1 rounded-full border border-risk-amber/30 bg-risk-amber-soft px-2 py-0.5 text-[11px] font-semibold text-risk-amber align-middle underline-offset-2 hover:underline"
    >
      <PackageX className="size-3" aria-hidden /> Not Available — Nearest Pharmacy
    </Link>
  );
}

/** Scans free text (e.g. a first-aid protocol) for medicines and shows their live availability. */
export function MedicineMentions({ text }: { text: string }) {
  const { data } = useMedicineInventory();
  if (!data) return null;
  const lower = text.toLowerCase();
  const mentioned = data.filter((r) => {
    const base = r.medicine_name.toLowerCase().replace(/\s*\d+\s*(mg|ml|g)\b.*/i, "").trim();
    return base.length > 3 && lower.includes(base);
  });
  if (mentioned.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted-foreground">Availability:</span>
      {mentioned.map((m) => (
        <span key={m.id} className="inline-flex items-center">
          <b className="font-medium">{m.medicine_name}</b>
          <MedicineBadge medicine={m.medicine_name} />
        </span>
      ))}
    </div>
  );
}