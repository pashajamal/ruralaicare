import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PageTab = { value: string; label: string; icon?: ReactNode; content: ReactNode };

/**
 * Shared shell for the consolidated navigation pages: one heading plus a tab
 * strip whose active tab is kept in the URL so links and reloads stay stable.
 */
export function TabbedPage({
  title,
  subtitle,
  tabs,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  tabs: PageTab[];
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      <Tabs value={value} onValueChange={onValueChange} className="space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-secondary p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2 rounded-lg px-4 py-2 text-sm">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
