import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PatientPicker, usePatients } from "@/components/PatientPicker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAssistant } from "@/lib/assistant.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "A case-scoped AI assistant that explains one patient's vitals, history and assessment — guidance only, never a medical decision.",
      },
      { property: "og:title", content: "AI Assistant | AI Virtual Clinic" },
      { property: "og:description", content: "Case-scoped guidance for clinic staff — the doctor still decides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; text: string };

const WORKER_PROMPTS = [
  "What do these vitals mean?",
  "What should I prepare before the doctor call?",
  "What should I watch for tonight?",
];
const DOCTOR_PROMPTS = [
  "Summarize this patient's last 3 visits.",
  "What changed since last week?",
  "Summarize the home-monitoring trend.",
];

function AssistantPage() {
  const { isDoctor } = useAuth();
  const { data: patients } = usePatients();
  const [patientId, setPatientId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askAssistant);

  async function send(text: string) {
    if (!patientId) {
      toast.error("Select a patient first — the assistant is scoped to one case");
      return;
    }
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const res = await ask({
        data: { patient_id: patientId, question: text, audience: isDoctor ? "doctor" : "health_worker" },
      });
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The assistant is unavailable right now");
    }
    setBusy(false);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5 pb-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Bot className="size-6 text-primary" aria-hidden /> AI assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scoped to one patient's case data only — not a general medical chatbot. It cannot change a risk tier, a
            decision or a note.
          </p>
        </header>

        <PatientPicker value={patientId} onChange={setPatientId} patients={patients ?? []} label="Case scope" />

        <div className="flex flex-wrap gap-2">
          {(isDoctor ? DOCTOR_PROMPTS : WORKER_PROMPTS).map((p) => (
            <Button key={p} size="sm" variant="outline" disabled={busy} onClick={() => void send(p)}>
              <Sparkles className="size-3.5" aria-hidden /> {p}
            </Button>
          ))}
        </div>

        <section className="min-h-64 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask a question about the selected case. Answers are drawn only from that patient's recorded data.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[90%] whitespace-pre-wrap rounded-2xl border border-risk-amber/30 bg-risk-amber-soft px-4 py-3 text-sm"
                }
              >
                {m.text}
              </div>
            ))
          )}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Reading the case record…
            </p>
          ) : null}
        </section>

        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this patient's case…"
            aria-label="Question"
          />
          <Button onClick={() => void send(question)} disabled={busy || !question.trim()}>
            <Send className="size-4" aria-hidden /> Ask
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
