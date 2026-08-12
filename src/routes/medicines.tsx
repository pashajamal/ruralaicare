import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarX, Loader2, PackagePlus, Pill, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useMedicineInventory } from "@/components/MedicineBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicine Inventory | AI Virtual Clinic" },
      {
        name: "description",
        content: "Live clinic medicine stock with quantities and expiry dates, used to check availability during case review.",
      },
      { property: "og:title", content: "Medicine Inventory | AI Virtual Clinic" },
      { property: "og:description", content: "Track medicine stock levels and expiry dates for the health centre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MedicinesPage,
});

function MedicinesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useMedicineInventory();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ medicine_name: "", quantity: "", expiry_date: "" });
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState<number>(() => {
    if (typeof window === "undefined") return 10;
    const stored = Number(window.localStorage.getItem("medicine-low-stock-threshold"));
    return Number.isFinite(stored) && stored > 0 ? stored : 10;
  });

  function updateThreshold(value: number) {
    const next = Number.isFinite(value) && value >= 0 ? value : 0;
    setThreshold(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("medicine-low-stock-threshold", String(next));
    }
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((r) => !term || r.medicine_name.toLowerCase().includes(term));
  }, [data, search]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);

  function statusOf(r: { quantity: number; expiry_date: string | null }) {
    const exp = r.expiry_date ? new Date(r.expiry_date) : null;
    if (exp && exp < today) return "expired" as const;
    if (r.quantity <= 0) return "out" as const;
    if (exp && exp <= soon) return "expiring" as const;
    if (r.quantity <= threshold) return "low" as const;
    return "ok" as const;
  }

  const all = data ?? [];
  const expired = all.filter((r) => statusOf(r) === "expired");
  const out = all.filter((r) => statusOf(r) === "out");
  const low = all.filter((r) => statusOf(r) === "low");
  const expiring = all.filter((r) => statusOf(r) === "expiring");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const name = form.medicine_name.trim();
    if (!name) return;
    setSaving(true);
    const payload = {
      medicine_name: name,
      quantity: Number(form.quantity || 0),
      expiry_date: form.expiry_date || null,
    };
    const { error } = editing
      ? await supabase.from("medicine_inventory").update(payload).eq("id", editing)
      : await supabase.from("medicine_inventory").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Could not save the stock entry");
      return;
    }
    toast.success(editing ? "Stock updated" : "Medicine added to inventory");
    setEditing(null);
    setForm({ medicine_name: "", quantity: "", expiry_date: "" });
    void qc.invalidateQueries({ queryKey: ["medicine-inventory"] });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Pill className="size-6 text-primary" aria-hidden /> Medicine Inventory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock here is checked live on the case review screen whenever a medicine is suggested.
          </p>
        </header>

        <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-4 sm:items-end">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="mname">Medicine name</Label>
            <Input
              id="mname"
              value={form.medicine_name}
              onChange={(e) => setForm({ ...form, medicine_name: e.target.value })}
              placeholder="e.g. Paracetamol 500mg"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mqty">Quantity in stock</Label>
            <Input
              id="mqty"
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mexp">Expiry date</Label>
            <Input id="mexp" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PackagePlus className="size-4" aria-hidden />}
              {editing ? "Save changes" : "Add stock"}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setForm({ medicine_name: "", quantity: "", expiry_date: "" });
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine"
            aria-label="Search medicine"
            className="pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Medicine name</th>
                <th className="px-4 py-3 font-semibold">Quantity in stock</th>
                <th className="px-4 py-3 font-semibold">Expiry date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <Loader2 className="mx-auto size-4 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No medicines recorded yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const expired = r.expiry_date ? new Date(r.expiry_date) < new Date() : false;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{r.medicine_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            r.quantity > 0 && !expired
                              ? "bg-risk-green-soft text-risk-green"
                              : "bg-risk-amber-soft text-risk-amber"
                          }`}
                        >
                          {r.quantity} {r.quantity > 0 && !expired ? "in stock" : expired ? "expired" : "out of stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.expiry_date ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(r.id);
                            setForm({
                              medicine_name: r.medicine_name,
                              quantity: String(r.quantity),
                              expiry_date: r.expiry_date ?? "",
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Edit stock
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}