import { useEffect, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut, X, FileText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export function DocumentViewer({
  path,
  analysis,
}: {
  path: string | null;
  analysis: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!path) return;
    void supabase.storage
      .from("clinic-uploads")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setError(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!path && !analysis) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FileText className="size-4" aria-hidden /> Uploaded document
        </h2>
        {url ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
            >
              <ZoomOut className="size-4" aria-hidden />
            </button>
            <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
            >
              <ZoomIn className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Open full screen"
              onClick={() => setFull(true)}
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-auto rounded-xl border border-border bg-secondary" style={{ maxHeight: 420 }}>
          {error ? (
            <p className="p-6 text-sm text-muted-foreground">Unable to load the uploaded file.</p>
          ) : url ? (
            <img
              src={url}
              alt="Uploaded wound photo or document as captured by the health worker"
              style={{ width: `${zoom * 100}%` }}
              className="block max-w-none"
            />
          ) : path ? (
            <p className="p-6 text-sm text-muted-foreground">Loading image…</p>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No image uploaded.</p>
          )}
        </div>

        <div className="rounded-xl border border-ai-border bg-ai-panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-risk-amber">
            AI image observation — requires human verification
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {analysis ?? "No AI observation recorded for this file."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Extracted text — verify against the original document. Observations describe what is visible only and are
            never a diagnosis. The original upload is never modified.
          </p>
        </div>
      </div>

      {full && url ? (
        <div
          role="dialog"
          aria-label="Full screen document"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-6"
          onClick={() => setFull(false)}
        >
          <button
            type="button"
            aria-label="Close full screen"
            className="absolute right-6 top-6 rounded-full bg-card p-2"
            onClick={() => setFull(false)}
          >
            <X className="size-5" aria-hidden />
          </button>
          <img src={url} alt="Uploaded document, full screen" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </section>
  );
}
