import { t } from "@/lib/i18n";
import { useLang } from "@/lib/lang";

export const CASE_FILTERS = ["All", "Red", "Yellow", "Green", "Pending", "Finalized"] as const;
export type CaseFilter = (typeof CASE_FILTERS)[number];

const FILTER_KEYS = {
  All: "all",
  Red: "red",
  Yellow: "yellow",
  Green: "green",
  Pending: "pending",
  Finalized: "finalized",
} as const;

/** Shared All / Red / Yellow / Green / Pending / Finalized chips. */
export function CaseFilterChips({ value, onChange }: { value: CaseFilter; onChange: (next: CaseFilter) => void }) {
  const { lang } = useLang();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter cases">
      {CASE_FILTERS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            value === option
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(lang, FILTER_KEYS[option])}
        </button>
      ))}
    </div>
  );
}

/** Matches a patient by name or mobile number (digits-only comparison). */
export function matchesPatient(term: string, name?: string | null, mobile?: string | null) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const phone = (mobile ?? "").replace(/\D/g, "");
  return (name ?? "").toLowerCase().includes(q) || (digits.length >= 3 && phone.includes(digits));
}