import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, MessageSquare, Phone, Radio, Send, Video } from "lucide-react";
import { toast } from "sonner";

import { CallRoom, type CallVisit } from "@/components/CallRoom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, logAudit, notify } from "@/lib/clinic";
import { useClinicPresence } from "@/lib/presence";

type ConsultType = "chat" | "audio" | "video";

type Props = {
  visitId: string;
  patientId: string;
  patientName: string;
  visitCentre: string;
  tier: string;
  callVisit?: CallVisit;
};

type Message = {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
};

export function CaseConsultBar({ visitId, patientId, patientName, visitCentre, tier, callVisit }: Props) {
  const { profile, role, isDoctor, session } = useAuth();
  const qc = useQueryClient();
  const { doctorOnline, doctors } = useClinicPresence();
  const [chatOpen, setChatOpen] = useState(false);
  const [call, setCall] = useState<{ type: "audio" | "video"; id: string | null } | null>(null);
  const [starting, setStarting] = useState<ConsultType | "urgent" | "request" | null>(null);

  const actor = {
    id: profile?.id,
    name: profile?.full_name,
    role: role ?? (isDoctor ? "doctor" : "health_worker"),
    healthCentre: profile?.health_centre,
  };

  const { data: urgent } = useQuery({
    queryKey: ["visit-urgent-consult", visitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("id, urgent_flag, status, created_at")
        .eq("visit_id", visitId)
        .eq("urgent_flag", true)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  /** Logs every consultation session started, whatever its type. */
  async function startConsultation(type: ConsultType, urgentFlag = false) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("consultations")
      .insert({
        visit_id: visitId,
        patient_id: patientId,
        health_centre: profile?.health_centre ?? visitCentre,
        type,
        initiated_by: session?.user?.id ?? null,
        ...(isDoctor
          ? { assigned_doctor: session?.user?.id ?? null }
          : { health_worker_id: session?.user?.id ?? null }),
        urgent_flag: urgentFlag,
        priority: urgentFlag ? "emergency" : tier === "RED" ? "urgent" : "routine",
        status: type === "chat" ? "waiting" : "in_consultation",
        started_at: now,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      toast.error("Could not start the consultation session");
      return null;
    }
    await logAudit(actor, {
      visitId,
      patientId,
      action: `${urgentFlag ? "Urgent " : ""}${type} consultation started`,
      detail: `Session type: ${type}${urgentFlag ? " · flagged urgent" : ""}`,
    });
    void qc.invalidateQueries({ queryKey: ["visit-urgent-consult", visitId] });
    void qc.invalidateQueries({ queryKey: ["doctor-workspace"] });
    return data?.id ?? null;
  }

  async function onChat() {
    setChatOpen((open) => !open);
    if (chatOpen) return;
    setStarting("chat");
    await startConsultation("chat");
    setStarting(null);
  }

  async function onCall(type: "audio" | "video") {
    setStarting(type);
    const id = await startConsultation(type);
    setStarting(null);
    setCall({ type, id });
    await notify({
      audience: isDoctor ? "health_worker" : "doctor",
      title: `${type === "video" ? "Video" : "Audio"} call started`,
      body: `${patientName} — ${profile?.full_name ?? "Clinic staff"}`,
      kind: "consultation",
      visitId,
      healthCentre: profile?.health_centre ?? visitCentre,
    });
  }

  async function onUrgent() {
    setStarting("urgent");
    const id = await startConsultation("chat", true);
    setStarting(null);
    if (!id) return;
    await notify({
      audience: "doctor",
      title: "URGENT doctor consult requested",
      body: `${patientName} — fast-track requested by ${profile?.full_name ?? "health worker"}`,
      kind: "emergency",
      visitId,
      healthCentre: profile?.health_centre ?? visitCentre,
    });
    setChatOpen(true);
    toast.success("Urgent consult raised — pinned to the top of the doctor's review queue");
  }

  async function endCall() {
    if (call?.id) {
      await supabase
        .from("consultations")
        .update({ status: "completed", ended_at: new Date().toISOString(), completed_at: new Date().toISOString() })
        .eq("id", call.id);
      await logAudit(actor, { visitId, patientId, action: `${call.type} consultation ended` });
      void qc.invalidateQueries({ queryKey: ["doctor-workspace"] });
    }
    setCall(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={chatOpen ? "default" : "outline"} onClick={onChat} disabled={starting === "chat"}>
          {starting === "chat" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageSquare className="size-4" aria-hidden />}
          Chat
        </Button>
        <Button size="sm" variant="outline" onClick={() => onCall("audio")} disabled={starting === "audio"}>
          {starting === "audio" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Phone className="size-4" aria-hidden />}
          Audio Call
        </Button>
        <Button size="sm" variant="outline" onClick={() => onCall("video")} disabled={starting === "video"}>
          {starting === "video" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Video className="size-4" aria-hidden />}
          Video Call
        </Button>
        {!isDoctor ? (
          <Button
            size="sm"
            onClick={onUrgent}
            disabled={starting === "urgent" || Boolean(urgent)}
            className="bg-risk-red text-white hover:bg-risk-red/90"
          >
            {starting === "urgent" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <AlertTriangle className="size-4" aria-hidden />
            )}
            {urgent ? "Urgent consult raised" : "Urgent Doctor Consult"}
          </Button>
        ) : null}
      </div>

      {urgent ? (
        <p className="flex items-center gap-2 rounded-xl border border-risk-red/30 bg-risk-red-soft px-3 py-2 text-xs font-semibold text-risk-red">
          <span className="inline-block size-2 animate-pulse rounded-full bg-risk-red" aria-hidden />
          URGENT consult active — pinned at the top of the doctor's review queue since {formatDateTime(urgent.created_at)}
        </p>
      ) : null}

      {chatOpen ? <ChatPanel visitId={visitId} patientId={patientId} visitCentre={visitCentre} /> : null}

      {call ? <CallScreen type={call.type} peer={isDoctor ? "Health worker" : "Doctor on call"} patientName={patientName} onEnd={endCall} /> : null}
    </div>
  );
}

function ChatPanel({ visitId, patientId, visitCentre }: { visitId: string; patientId: string; visitCentre: string }) {
  const { profile, role, isDoctor, session } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["visit-messages", visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_messages")
        .select("id, sender_id, sender_name, sender_role, body, created_at")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`visit-messages-${visitId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visit_messages", filter: `visit_id=eq.${visitId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["visit-messages", visitId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [visitId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("visit_messages").insert({
      visit_id: visitId,
      health_centre: visitCentre,
      sender_id: session?.user?.id ?? null,
      sender_name: profile?.full_name || (isDoctor ? "Doctor" : "Health worker"),
      sender_role: role ?? (isDoctor ? "doctor" : "health_worker"),
      body: text,
    });
    setSending(false);
    if (error) {
      toast.error("Message could not be sent");
      return;
    }
    setBody("");
    await logAudit(
      { id: profile?.id, name: profile?.full_name, role: role ?? "staff", healthCentre: profile?.health_centre },
      { visitId, patientId, action: "Case chat message sent" },
    );
    void qc.invalidateQueries({ queryKey: ["visit-messages", visitId] });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Case chat — doctor &amp; health worker
      </p>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (messages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation about this case.</p>
        ) : (
          (messages ?? []).map((m) => {
            const mine = m.sender_id === session?.user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <p className="text-[11px] font-semibold capitalize opacity-80">
                    {m.sender_name} · {m.sender_role.replace("_", " ")}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">{formatDateTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a message about this case…"
          aria-label="Chat message"
        />
        <Button onClick={send} disabled={sending || !body.trim()}>
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          Send
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Messages are stored on the visit record and visible to the assigned doctor and the submitting health worker.
      </p>
    </div>
  );
}
