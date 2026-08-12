import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { searchSymptomKnowledgeFn } from "@/lib/symptom-search.functions";

export const Route = createFileRoute("/symptom-search")({
  head: () => ({
    meta: [
      { title: "Symptom Search | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "Search the clinical knowledge base by symptom description and see the closest matching diseases with similarity scores and source examples.",
      },
      { property: "og:title", content: "Symptom Search | AI Virtual Clinic" },
      {
        property: "og:description",
        content: "Semantic symptom lookup over the grounded clinical knowledge base.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SymptomSearchPage,
});

const EXAMPLES = [
  "high fever with chills and body ache for 3 days",
  "itchy red rash on arms after new soap",
  "burning urination and lower abdominal pain",
];

function scoreTone(score: number) {
  if (score >= 0.8) return "bg-risk-green-soft text-risk-green border-risk-green/30";
  if (score >= 0.6) return "bg-risk-amber-soft text-risk-amber border-risk-amber/30";
  return "bg-secondary text-muted-foreground border-border";
}

function SymptomSearchPage() {
  const [query, setQuery] = useState("");
  const search = useServerFn(searchSymptomKnowledgeFn);

  const mutation = useMutation({
    mutationFn: (q: string) => search({ data: { query: q } }),
  });

  const run = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    setQuery(trimmed);
    mutation.mutate(trimmed);
  };

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Symptom search</h1>
          <p className="text-sm text-muted-foreground">
            Describe the symptoms in plain language. We search the grounded clinical knowledge base and show the
            closest matching conditions — reference information only, never a diagnosis.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Label htmlFor="symptom-query">Symptom description</Label>
          <Textarea
            id="symptom-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="e.g. persistent dry cough, mild fever and chest tightness for a week"
            className="mt-2"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => run(query)} disabled={mutation.isPending || query.trim().length < 3}>
              <Search className="size-4" aria-hidden />
              {mutation.isPending ? "Searching…" : "Search knowledge base"}
            </Button>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => run(ex)}
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          {mutation.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {mutation.error instanceof Error ? mutation.error.message : "Search failed. Please try again."}
            </p>
          ) : null}
        </section>

        {mutation.data ? (
          mutation.data.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching entries found in the knowledge base.</p>
          ) : (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Top matches ({mutation.data.matches.length})
              </h2>
              {mutation.data.matches.map((m, i) => (
                <article key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Match #{i + 1}</p>
                      <h3 className="text-lg font-semibold capitalize">{m.disease}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Source: {m.source_type}</p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${scoreTone(m.similarity)}`}
                    >
                      {(m.similarity * 100).toFixed(1)}% similarity
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-foreground/90">{m.matched_text}</p>

                  {m.examples.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="size-3.5" aria-hidden /> Retrieved symptom examples
                      </p>
                      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                        {m.examples.map((ex, idx) => (
                          <li key={idx}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          )
        ) : null}
      </div>
    </AppShell>
  );
}
