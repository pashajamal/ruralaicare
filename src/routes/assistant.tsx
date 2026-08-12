import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PatientPicker, usePatients } from "@/components/PatientPicker";
import { SpeakButton } from "@/components/SpeakButton";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { askAssistant } from "@/lib/assistant.functions";
import { useAuth } from "@/lib/auth";
import { AUTO_DETECT, PATIENT_LANGUAGES } from "@/lib/speech";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant | AI Virtual Clinic" },
      {
        name: "description",
        content:
          "An AI health assistant for rural clinic staff — general health information, or scoped to one patient's case. Guidance only, never a medical decision.",
      },
      { property: "og:title", content: "AI Assistant | AI Virtual Clinic" },
      { property: "og:description", content: "Voice-enabled health guidance in regional languages — the doctor still decides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; text: string };

const WORKER_PROMPTS = [
  "How do I clean and dress a minor wound?",
  "What are the danger signs in a child with fever?",
  "How should ORS be prepared and given?",
];
const DOCTOR_PROMPTS = [
  "Summarize current first-line management of dehydration.",
  "What are red-flag features of chest pain?",
  "Key counselling points for a newly diagnosed diabetic.",
];

function AssistantPage() {
  const { isDoctor } = useAuth();
  const { data: patients } = usePatients();
  const [patientId, setPatientId] = useState("");
  const [language, setLanguage] = useState<string>("English");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askAssistant);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const res = await ask({
        data: {
          patient_id: patientId || null,
          question: text,
          audience: isDoctor ? "doctor" : "health_worker",
          language,
        },
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
            Ask general health questions, or pick a patient to scope answers to that case. It never diagnoses and cannot
            change a risk tier, a decision or a note.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="assistant-language">Answer language</Label>
            <select
              id="assistant-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
            >
              {PATIENT_LANGUAGES.filter((l) => l !== AUTO_DETECT).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <PatientPicker
            value={patientId}
            onChange={setPatientId}
            patients={patients ?? []}
            label="Patient case (optional)"
          />
        </div>

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
                    : "max-w-[90%] space-y-2 rounded-2xl border border-risk-amber/30 bg-risk-amber-soft px-4 py-3 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.role === "assistant" ? (
                  <SpeakButton text={m.text} language={language} label="Listen" showTranscript={false} />
                ) : null}
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
          <VoiceRecorder
            field="question"
            languageHint={language}
            onTranscript={(text) => setQuestion((q) => (q ? `${q} ${text}` : text))}
          />
          <Button onClick={() => void send(question)} disabled={busy || !question.trim()}>
            <Send className="size-4" aria-hidden /> Ask
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
