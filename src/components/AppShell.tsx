import { Link } from "@tanstack/react-router";
import { ClipboardPlus, ListChecks, History, Settings, Stethoscope, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "New Patient Intake", icon: ClipboardPlus },
  { to: "/queue", label: "Patient Queue", icon: ListChecks },
  { to: "/history", label: "Patient History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">AI Virtual Clinic</p>
            <p className="text-xs text-muted-foreground">Rural health worker suite</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <p className="px-6 py-6 text-xs leading-relaxed text-muted-foreground">
          Clinical decision support only. A licensed doctor finalizes every case.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-2 md:hidden">
            <Stethoscope className="size-5 text-primary" />
            <span className="text-sm font-semibold">AI Virtual Clinic</span>
          </div>
          <TrustBadge />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function TrustBadge() {
  return (
    <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
      <ShieldCheck className="size-4 text-primary" />
      <span>AI Suggestion</span>
      <span className="text-muted-foreground">vs</span>
      <span>Doctor Decision</span>
      <span className="hidden text-muted-foreground sm:inline">— nothing is final until a doctor signs off</span>
    </div>
  );
}
