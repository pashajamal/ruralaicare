import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { localeFor } from "@/lib/speech";
import { speakText } from "@/lib/voice.functions";

type Props = {
  text: string;
  language: string;
  label?: string;
  /** Transcript shown under the button for accessibility and doctor review. */
  showTranscript?: boolean;
};

/** Explicit-tap playback only — never auto-plays, since clinic rooms are shared. */
export function SpeakButton({ text, language, label = "Play aloud", showTranscript = true }: Props) {
  const run = useServerFn(speakText);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<string | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }

  async function play() {
    if (playing) {
      stop();
      return;
    }
    setBusy(true);
    try {
      if (!cacheRef.current) {
        const result = await run({ data: { text: text.slice(0, 4000), language } });
        cacheRef.current = `data:audio/mpeg;base64,${result.audio_base64}`;
      }
      const audio = new Audio(cacheRef.current);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      await audio.play();
      setPlaying(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not play this response.");
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  if (!text.trim()) return null;

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void play()}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : playing ? (
          <Square className="size-4" aria-hidden />
        ) : (
          <Volume2 className="size-4" aria-hidden />
        )}
        {playing ? "Stop" : label}
        <span className="text-xs font-normal text-muted-foreground">· {language}</span>
      </Button>
      {showTranscript ? (
        <p className="rounded-xl bg-card p-3 text-xs text-muted-foreground" lang={localeFor(language)}>
          <b className="text-foreground">Spoken transcript:</b> {text}
        </p>
      ) : null}
    </div>
  );
}
