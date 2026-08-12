import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type CallMode = "video" | "audio";
export type CallStatus = "idle" | "requesting_media" | "waiting" | "connecting" | "connected" | "ended" | "error";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
};

type Signal =
  | { kind: "description"; from: string; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; from: string; candidate: RTCIceCandidateInit }
  | { kind: "bye"; from: string };

/**
 * 1:1 WebRTC call using Supabase Realtime broadcast for signalling.
 * `polite` follows the perfect-negotiation pattern so both sides can start at once.
 */
export function usePeerCall(args: {
  roomId: string | null;
  selfId: string;
  mode: CallMode;
  polite: boolean;
  onEnded?: () => void;
}) {
  const { roomId, selfId, mode, polite } = args;
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [peerPresent, setPeerPresent] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(mode === "video");

  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const onEndedRef = useRef(args.onEnded);
  onEndedRef.current = args.onEnded;

  const send = useCallback((payload: Signal) => {
    void channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    const remoteStream = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
      if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
      setStatus("connected");
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) send({ kind: "candidate", from: selfId, candidate: event.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (pc.connectionState === "failed") {
        setStatus("error");
        setError("The connection dropped. Check the network and retry, or fall back to audio-only.");
      }
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        if (pc.localDescription) send({ kind: "description", from: selfId, description: pc.localDescription.toJSON() });
      } catch {
        /* renegotiation retried on the next event */
      } finally {
        makingOffer.current = false;
      }
    };

    const channel = supabase.channel(`rtc-${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: selfId } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const signal = payload as Signal;
        if (signal.from === selfId) return;
        try {
          if (signal.kind === "bye") {
            setStatus("ended");
            onEndedRef.current?.();
            return;
          }
          if (signal.kind === "candidate") {
            try {
              await pc.addIceCandidate(signal.candidate);
            } catch {
              /* candidate arrived before the description — safe to drop */
            }
            return;
          }
          const offerCollision = signal.description.type === "offer" && (makingOffer.current || pc.signalingState !== "stable");
          ignoreOffer.current = !polite && offerCollision;
          if (ignoreOffer.current) return;
          await pc.setRemoteDescription(signal.description);
          if (signal.description.type === "offer") {
            await pc.setLocalDescription();
            if (pc.localDescription) send({ kind: "description", from: selfId, description: pc.localDescription.toJSON() });
          }
          setStatus((s) => (s === "connected" ? s : "connecting"));
        } catch {
          /* ignore malformed signalling frames */
        }
      })
      .on("presence", { event: "sync" }, () => {
        const others = Object.keys(channel.presenceState()).filter((k) => k !== selfId);
        setPeerPresent(others.length > 0);
        setStatus((s) => (s === "waiting" && others.length > 0 ? "connecting" : s));
      })
      .subscribe(async (state) => {
        if (state !== "SUBSCRIBED" || cancelled) return;
        await channel.track({ id: selfId });
      });

    void (async () => {
      setStatus("requesting_media");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video" ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        setStatus((s) => (s === "connected" ? s : "waiting"));
      } catch {
        setStatus("error");
        setError("Camera/microphone permission was denied. Allow access, then rejoin the call.");
      }
    })();

    return () => {
      cancelled = true;
      send({ kind: "bye", from: selfId });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
      pcRef.current = null;
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, selfId, mode, polite, send]);

  const toggleMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  /** One-tap low-bandwidth fallback: stops sending video, keeps the same call up. */
  const toggleCam = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  const hangUp = useCallback(() => {
    send({ kind: "bye", from: selfId });
    setStatus("ended");
  }, [selfId, send]);

  return { status, error, peerPresent, micOn, camOn, toggleMic, toggleCam, hangUp, localRef, remoteRef };
}
