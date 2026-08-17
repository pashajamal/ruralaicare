import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookMarked,
  Bot,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Menu,
  ScanText,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { NotificationBell } from "@/components/NotificationBell";
import clinicLogo from "@/assets/clinic-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { t, UI_LANGUAGES } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { readPending } from "@/lib/offline";

type NavItem = { to: string; key: Parameters<typeof t>[1]; icon: typeof LayoutDashboard };
type NavGroup = { label?: Parameters<typeof t>[1]; items: NavItem[] };

const WORKER_NAV: NavGroup[] = [
  {
    items: [
      { to: "/", key: "dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "grpCases",
    items: [
      { to: "/queue", key: "queue", icon: ListChecks },
      { to: "/cases", key: "caseHistory", icon: History },
    ],
  },
  {
    label: "grpCare",
    items: [
      { to: "/monitoring", key: "monitoring", icon: HeartPulse },
      { to: "/referrals", key: "referrals", icon: Send },
    ],
  },
  {
    label: "grpTools",
    items: [
      { to: "/assistant", key: "assistant", icon: Bot },
      { to: "/diagnostics", key: "diagnostics", icon: FlaskConical },
      { to: "/resources", key: "resources", icon: BookMarked },
      { to: "/settings", key: "settings", icon: Settings },
    ],
  },
];

const DOCTOR_NAV: NavGroup[] = [
  {
    items: [
      { to: "/", key: "dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "grpCases",
    items: [
      { to: "/doctor", key: "reviewQueue", icon: Stethoscope },
      { to: "/cases", key: "caseHistory", icon: History },
    ],
  },
  {
    label: "grpCare",
    items: [
      { to: "/care-plans", key: "carePlans", icon: FileText },
      { to: "/monitoring", key: "monitoring", icon: HeartPulse },
      { to: "/referrals", key: "referrals", icon: Send },
    ],
  },
  {
    label: "grpTools",
    items: [
      { to: "/assistant", key: "assistant", icon: Bot },
      { to: "/diagnostics", key: "diagnostics", icon: FlaskConical },
      { to: "/resources", key: "resources", icon: BookMarked },
      { to: "/analytics", key: "analytics", icon: BarChart3 },
      { to: "/trends", key: "trends", icon: LineChart },
      { to: "/prescriptions", key: "prescriptions", icon: ScanText },
      { to: "/settings", key: "settings", icon: Settings },
    ],
  },
];

function NavLinks({
  groups,
  lang,
  onNavigate,
}: {
  groups: NavGroup[];
  lang: Parameters<typeof t>[0];
  onNavigate?: () => void;
}) {
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
          {group.label ? (
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t(lang, group.label)}
            </p>
          ) : null}
          {group.items.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{t(lang, key)}</span>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    const count = () => setPending(readPending().length);
    sync();
    count();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("clinic:pending-changed", count);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("clinic:pending-changed", count);
    };
  }, []);

  return { online, pending };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, session, profile, role, isDoctor, signOut } = useAuth();
  const navigate = useNavigate();
  const { online, pending } = useOnline();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, setLang } = useLang();
  const nav = isDoctor ? DOCTOR_NAV : WORKER_NAV;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <img
            src={clinicLogo.url}
            alt="AI Virtual Clinic logo"
            className="size-10 shrink-0 rounded-xl object-contain"
          />
          <div>
            <p className="text-sm font-semibold leading-tight">AI Virtual Clinic</p>
            <p className="text-xs text-muted-foreground">
              AI-assisted clinical workflow
            </p>
          </div>
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
          <NavLinks groups={nav} lang={lang} />
        </nav>

        {session ? (
          <div className="border-t border-border px-4 py-4">
            <p className="truncate text-sm font-medium">{profile?.full_name || session.user.email}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {(role ?? "staff").replace("_", " ")} · {profile?.health_centre}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-2"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" aria-hidden /> {t(lang, "signOut")}
            </Button>
          </div>
        ) : null}

        <p className="px-6 py-4 text-xs leading-relaxed text-muted-foreground">{t(lang, "positioning")}</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" aria-label="Open menu">
                  <Menu className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-full w-72 flex-col p-0">
                <SheetHeader className="px-5 py-4 text-left">
                  <SheetTitle className="flex items-center gap-2 text-sm">
                    <img src={clinicLogo.url} alt="" className="size-6 rounded-md object-contain" />
                    AI Virtual Clinic
                  </SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
                  <NavLinks groups={nav} lang={lang} onNavigate={() => setMobileOpen(false)} />
                </nav>
                {session ? (
                  <div className="border-t border-border px-4 py-4">
                    <p className="truncate text-sm font-medium">
                      {profile?.full_name || session.user.email}
                    </p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {(role ?? "staff").replace("_", " ")} · {profile?.health_centre}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-start px-2"
                      onClick={async () => {
                        setMobileOpen(false);
                        await signOut();
                        void navigate({ to: "/auth" });
                      }}
                    >
                      <LogOut className="size-4" aria-hidden /> {t(lang, "signOut")}
                    </Button>
                  </div>
                ) : null}
              </SheetContent>
            </Sheet>
            <img src={clinicLogo.url} alt="" className="size-6 shrink-0 rounded-md object-contain" />
            <span className="truncate text-sm font-semibold">AI Virtual Clinic</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {!online ? (
              <span className="flex items-center gap-2 rounded-full border border-risk-amber/30 bg-risk-amber-soft px-3 py-1.5 text-xs font-semibold text-risk-amber">
                <WifiOff className="size-4" aria-hidden /> Limited connectivity — working offline
              </span>
            ) : pending > 0 ? (
              <Link
                to="/intake"
                className="flex items-center gap-2 rounded-full border border-risk-amber/30 bg-risk-amber-soft px-3 py-1.5 text-xs font-semibold text-risk-amber"
              >
                <Activity className="size-4" aria-hidden /> {pending} record{pending > 1 ? "s" : ""} waiting to sync
              </Link>
            ) : null}
            <TrustBadge />
            {session ? (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label={t(lang, "signOut")}
                onClick={async () => {
                  await signOut();
                  void navigate({ to: "/auth" });
                }}
              >
                <LogOut className="size-5" aria-hidden />
              </Button>
            ) : null}
            <label className="sr-only" htmlFor="lang-switch">
              {t(lang, "language")}
            </label>
            <select
              id="lang-switch"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="h-8 rounded-full border border-border bg-secondary px-2 text-xs font-medium"
            >
              {UI_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {session ? <NotificationBell /> : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !session ? (
            <SignedOutCard />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function SignedOutCard() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <ShieldCheck className="mx-auto size-8 text-primary" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">Sign in required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Patient records are restricted to signed-in clinic staff.
      </p>
      <Button asChild className="mt-4 w-full">
        <Link to="/auth">Go to sign in</Link>
      </Button>
    </div>
  );
}

export function TrustBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
      <ShieldCheck className="size-4 text-primary" aria-hidden />
      <span className="font-semibold uppercase tracking-wide">AI assistance ≠ medical decision</span>
      <span className="hidden text-muted-foreground lg:inline">— a doctor signs off every case</span>
    </div>
  );
}
