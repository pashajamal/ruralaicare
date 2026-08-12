import { useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, X } from "lucide-react";
import { toast } from "sonner";

import { RiskPill } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, logAudit } from "@/lib/clinic";
import { usePeerCall, type CallMode } from "@/lib/webrtc";

export type CallVisit = {
  id: string;
  patient_id: string;
  created_at: string;
  symptoms_text: string;
  duration: string | null;
  history_text: string | null;
  vitals: unknown;
  risk_tier: string | null;
  triggering_rules: unknown;
  preliminary_assessment: string | null;
  protocol_text: string | null;
  doctor_notes: string | null;
  patient_name: string;
  patient_age: number | null;
};

/** Live 1:1 consultation: call stage on the left, the case the doctor is discussing on the right. */
export function CallRoom({
  consultationId,
  visit,
  mode,
  onClose,
}: {
  consultationId: string;
  visit: CallVisit;
  mode: CallMode;
  onClose: () => void;
}) {
  const { profile, role, isDoctor, session } = useAuth();
  const selfId = session?.user?.id ?? "anonymous";
  const [callMode, setCallMode] = useState<CallMode>(mode);
  const [ended, setEnded] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const call = usePeerCall({
    roomId: ended ? null : consultationId,
    selfId,
    mode: callMode,
    polite: !isDoctor,
    onEnded: () => setEnded(true),
  });

  const vitals = (visit.vitals ?? {}) as Record<string, string | number | null>;
  const rules = Array.isArray(visit.triggering_rules) ? (visit.triggering_rules as string[]) : [];

  async function endCall() {
    call.hangUp();
    setEnded(true);
    await supabase
      .from("consultations")
      .update({ status: "completed", ended_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .eq("id", consultationId);
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId: visit.id, patientId: visit.patient_id, action: `${callMode} consultation ended` },
    );
  }

  /** Notes land on the same visit record as the approve/modify/override decision. */
  async function saveNotes() {
    const text = notes.trim();
    if (!text) {
      onClose();
      return;
    }
    setSaving(true);
    const stamp = `[Live ${callMode} consultation · ${formatDateTime(new Date().toISOString())} · ${profile?.full_name ?? "clinician"}]\n${text}`;
    const merged = visit.doctor_notes ? `${visit.doctor_notes}\n\n${stamp}` : stamp;
    const [{ error: cErr }, { error: vErr }] = await Promise.all([
      supabase.from("consultations").update({ notes: text }).eq("id", consultationId),
      supabase.from("visits").update({ doctor_notes: merged, updated_at: new Date().toISOString() }).eq("id", visit.id),
    ]);
    setSaving(false);
    if (cErr || vErr) {
      toast.error("Consultation notes could not be saved");
      return;
    }
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId: visit.id, patientId: visit.patient_id, action: "Consultation notes recorded", detail: text.slice(0, 200) },
    );
    toast.success("Consultation notes saved to the case record");
    onClose();
  }

  const statusLine =
    call.status === "connected"
      ? "Connected"
      : call.status === "requesting_media"
        ? "Requesting camera and microphone…"
        : call.status === "waiting"
          ? call.peerPresent
            ? "Peer joined — connecting…"
            : "Waiting for the other participant to join…"
          : call.status === "connecting"
            ? "Connecting…"
            : call.status === "error"
              ? call.error ?? "Call error"
              : "Call ended";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-foreground/70 p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="mx-auto grid w-full max-w-6xl grid-rows-[auto_1fr] overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:grid-cols-[1.6fr_1fr] lg:grid-rows-1">
        {/* Call stage */}
        <div className="flex min-h-0 flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live {callMode} consultation
              </p>
              <p className="text-sm font-semibold">{visit.patient_name}</p>
            </div>
            <button onClick={onClose} aria-label="Close consultation window" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {ended ? (
            <div className="flex-1 space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-sm font-semibold">Call ended — add consultation notes</p>
              <div className="space-y-2">
                <Label htmlFor="consult-notes">Consultation notes</Label>
                <Textarea
                  id="consult-notes"
                  rows={7}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed, what was observed live, and what the doctor advised…"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Saved onto this visit's doctor record, alongside the approve / modify / override decision.
              </p>
              <div className="flex gap-2">
                <Button onClick={saveNotes} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save notes
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Skip
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative min-h-64 flex-1 overflow-hidden rounded-xl bg-foreground/90">
                <video
                  ref={call.remoteRef}
                  autoPlay
                  playsInline
                  className={`size-full object-cover ${callMode === "video" ? "" : "hidden"}`}
                />
                {callMode === "audio" ? (
                  <div className="flex size-full items-center justify-center">
                    <Mic className="size-14 text-background/70" aria-hidden />
                  </div>
                ) : null}
                <video
                  ref={call.localRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute bottom-3 right-3 w-32 rounded-lg border border-background/30 object-cover ${
                    callMode === "video" ? "" : "hidden"
                  }`}
                />
                <p
                  className="absolute left-3 top-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium"
                  aria-live="polite"
                >
                  {call.status !== "connected" && call.status !== "error" ? (
                    <Loader2 className="mr-1 inline size-3 animate-spin" aria-hidden />
                  ) : null}
                  {statusLine}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={call.toggleMic}>
                  {call.micOn ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
                  {call.micOn ? "Mute" : "Unmute"}
                </Button>
                {callMode === "video" ? (
                  <>
                    <Button variant="outline" onClick={call.toggleCam}>
                      {call.camOn ? <Video className="size-4" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
                      {call.camOn ? "Camera off" : "Camera on"}
                    </Button>
                    <Button variant="outline" onClick={() => setCallMode("audio")}>
                      Switch to audio-only
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setCallMode("video")}>
                    <Video className="size-4" aria-hidden /> Turn on video
                  </Button>
                )}
                <Button variant="destructive" onClick={endCall}>
                  <PhoneOff className="size-4" aria-hidden /> End call
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                On a weak rural connection, switch to audio-only — the call stays up, only video stops.
              </p>
            </>
          )}
        </div>

        {/* Case side panel */}
        <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border bg-secondary/30 p-4 text-sm lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{visit.patient_name}</p>
              <p className="text-xs text-muted-foreground">
                {visit.patient_age ? `${visit.patient_age} yrs · ` : ""}
                {formatDateTime(visit.created_at)}
              </p>
            </div>
            <RiskPill tier={visit.risk_tier} withLabel />
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {[
                ["Temp", vitals["temperature"] ? `${vitals["temperature"]} °C` : "—"],
                ["BP", vitals["blood_pressure"] ?? "—"],
                ["Pulse", vitals["pulse"] ?? "—"],
                ["SpO2", vitals["spo2"] ? `${vitals["spo2"]} %` : "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg border border-border bg-card px-3 py-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {rules.length ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Triggering rules</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {rules.map((r) => (
                  <li key={r} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Intake summary</h3>
            <p className="mt-2 whitespace-pre-wrap">{visit.symptoms_text}</p>
            {visit.duration ? <p className="mt-1 text-xs text-muted-foreground">Duration: {visit.duration}</p> : null}
            {visit.history_text ? <p className="mt-1 text-xs text-muted-foreground">History: {visit.history_text}</p> : null}
          </div>

          <div className="rounded-xl border border-risk-amber/30 bg-risk-amber-soft p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-risk-amber">AI suggestion — pending doctor review</h3>
            <p className="mt-2 whitespace-pre-wrap">{visit.preliminary_assessment || "No AI assessment recorded."}</p>
            {visit.protocol_text ? <p className="mt-2 whitespace-pre-wrap text-xs">{visit.protocol_text}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
