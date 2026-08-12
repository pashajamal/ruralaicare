import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { blobToBase64, encodeWav } from "@/lib/speech";
import { transcribeVoiceNote } from "@/lib/voice.functions";

type Props = {
  field: "symptoms" | "history" | "question";
  languageHint: string;
  /** Called with the transcript so the caller can fill the (still editable) text field. */
  onTranscript: (text: string, detectedLanguage: string) => void;
};

/**
 * Record-and-stop mic toggle. Captures PCM and uploads one complete WAV, which the
 * server sends to the multimodal intake call — no separate STT provider.
 */
export function VoiceRecorder({ field, languageHint, onTranscript }: Props) {
  const run = useServerFn(transcribeVoiceNote);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is needed to record. You can still type instead.");
      return;
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    chunksRef.current = [];
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunksRef.current.push(new Float32Array(data));
      let peak = 0;
      for (let i = 0; i < data.length; i += 64) peak = Math.max(peak, Math.abs(data[i] ?? 0));
      setLevel(peak);
    };
    source.connect(node);
    node.connect(ctx.destination);
    ctxRef.current = ctx;
    streamRef.current = stream;
    nodeRef.current = node;
    sourceRef.current = source;
    setRecording(true);
  }

  async function stop() {
    setRecording(false);
    setLevel(0);
    const ctx = ctxRef.current;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    const sampleRate = ctx?.sampleRate ?? 48000;
    await ctx?.close();
    ctxRef.current = null;

    const blob = encodeWav(chunksRef.current, sampleRate);
    chunksRef.current = [];
    if (blob.size < 4000) {
      toast.error("That recording was too short or silent — please record again.");
      return;
    }

    setBusy(true);
    try {
      const audio_base64 = await blobToBase64(blob);
      const result = await run({ data: { audio_base64, format: "wav", field, language_hint: languageHint } });
      onTranscript(result.transcript, result.detected_language);
      toast.success("Voice note transcribed — review and edit before submitting.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transcribe that recording.");
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <span className="flex items-end gap-0.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-risk-red transition-all duration-100"
              style={{ height: `${6 + Math.min(18, level * 90 * (1 + ((i % 3) * 0.4)))}px` }}
            />
          ))}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={recording ? "destructive" : "outline"}
        disabled={busy}
        onClick={() => void (recording ? stop() : start())}
        aria-label={recording ? `Stop recording ${field}` : `Record ${field} by voice`}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : recording ? (
          <Square className="size-4" aria-hidden />
        ) : (
          <Mic className="size-4" aria-hidden />
        )}
        {busy ? "Transcribing…" : recording ? "Stop" : "Speak"}
      </Button>
    </div>
  );
}
