/** Shared, client-safe language + audio helpers for voice intake and voice playback. */

export const AUTO_DETECT = "Auto-detect";

/** Patient-facing languages offered on the intake form (used for TTS + as an LLM hint). */
export const PATIENT_LANGUAGES = [
  AUTO_DETECT,
  "English",
  "Hindi",
  "Hinglish",
  "Bangla",
  "Tamil",
  "Telugu",
  "Marathi",
] as const;

export type PatientLanguage = (typeof PATIENT_LANGUAGES)[number];

const LOCALES: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Hinglish: "hi-IN",
  Bangla: "bn-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Marathi: "mr-IN",
};

/** BCP-47 locale used for the `lang` attribute / speech output hints. */
export function localeFor(language: string | null | undefined): string {
  return LOCALES[language ?? ""] ?? "en-IN";
}

/** Resolves the language to speak in: explicit selection wins, else the detected one. */
export function spokenLanguage(selected?: string | null, detected?: string | null): string {
  if (selected && selected !== AUTO_DETECT) return selected;
  return detected || "English";
}

/** Encodes captured mono PCM chunks as a complete 16-bit WAV file (16 kHz). */
export function encodeWav(chunks: Float32Array[], sampleRate: number, target = 16000): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const ratio = sampleRate / target;
  const outLength = Math.max(1, Math.floor(merged.length / ratio));
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const s = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)] ?? 0));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(44 + i * 2, samples[i]!, true);

  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
