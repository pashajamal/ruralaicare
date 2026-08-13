import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, ImageOff, Loader2, X } from "lucide-react";

import { getVisitImageUrl } from "@/lib/visit-image.functions";

/** Short-lived signed URL for one visit's photo, fetched server-side under the visit's own RLS scope. */
function useVisitImage(visitId: string, enabled: boolean) {
  const fetchUrl = useServerFn(getVisitImageUrl);
  return useQuery({
    queryKey: ["visit-image", visitId],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchUrl({ data: { visit_id: visitId } }),
  });
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Patient photo, full size"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close photo"
        className="absolute right-6 top-6 rounded-full bg-card p-2"
        onClick={onClose}
      >
        <X className="size-5" aria-hidden />
      </button>
      <img src={url} alt="Patient upload, full size" className="max-h-full max-w-full object-contain" />
    </div>
  );
}

function Unavailable({ compact }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary text-xs text-muted-foreground ${
        compact ? "px-2 py-1" : "px-3 py-6"
      }`}
    >
      <ImageOff className="size-3.5" aria-hidden /> Photo unavailable
    </span>
  );
}

/**
 * Thumbnail + AI observation for the amber "AI suggestion" panel.
 * Renders nothing when the visit has no uploaded photo, so text-only visits keep today's layout.
 */
export function VisitPhotoCard({
  visitId,
  hasImage,
  analysis,
}: {
  visitId: string;
  hasImage: boolean;
  analysis: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const { data, isLoading, isError } = useVisitImage(visitId, hasImage);

  if (!hasImage) return null;
  const url = data?.url ?? null;
  const note = analysis ?? data?.analysis ?? null;

  return (
    <div className="mt-4 rounded-xl bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient photo upload</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        {isLoading ? (
          <span className="flex size-28 items-center justify-center rounded-lg border border-border bg-secondary">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          </span>
        ) : isError || !url || broken ? (
          <Unavailable />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open the patient photo full size"
            className="size-28 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
          >
            <img
              src={url}
              alt="Wound photo or prescription uploaded by the health worker"
              className="size-full object-cover"
              onError={() => setBroken(true)}
            />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-risk-amber">AI image note — not a diagnosis</p>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {note ?? "No AI observation was recorded for this photo."}
          </p>
        </div>
      </div>

      {open && url ? <Lightbox url={url} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/** Small camera icon for table rows; opens the same lightbox on click. */
export function VisitPhotoIcon({ visitId, hasImage }: { visitId: string; hasImage: boolean }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useVisitImage(visitId, hasImage && open);

  if (!hasImage) return null;
  const url = data?.url ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View the photo attached to this visit"
        title="Photo attached"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ImageIcon className="size-4" aria-hidden />
      </button>
      {open ? (
        isLoading ? (
          <span className="ml-1 inline-flex"><Loader2 className="size-3.5 animate-spin" aria-hidden /></span>
        ) : isError || !url ? (
          <span className="ml-1"><Unavailable compact /></span>
        ) : (
          <Lightbox url={url} onClose={() => setOpen(false)} />
        )
      ) : null}
    </>
  );
}
