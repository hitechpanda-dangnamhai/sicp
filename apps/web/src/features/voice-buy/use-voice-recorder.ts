'use client';

/**
 * apps/web/src/features/voice-buy/use-voice-recorder.ts
 *
 * React hook: MediaRecorder lifecycle for voice capture (Intent 02 state-A).
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW (B3)
 *
 * Source:   NEW (not cloned). MediaRecorder Web API.
 *
 * Decisions applied:
 * - R-S08-2: cross-browser MIME — try `audio/webm` (Chrome), fallback `audio/mp4`
 *   (Safari iOS16+); feature-detect via `MediaRecorder.isTypeSupported`.
 * - §2.3 + §3.2: just-in-time permission gate via getUserMedia → on reject set
 *   errorCode `E_PERMISSION_DENIED` (FE-side only; BE never raises this).
 * - Timer ≤30s auto-stop (mockup state-A "tối đa 30 giây").
 * - StrictMode-safe: cleanup stops stream tracks + clears timer on unmount.
 * - Returns naked base64 (strips `data:...;base64,` prefix) for POST /intent.
 * - C-15 'use client': hooks + browser APIs.
 *
 * Public API:
 *   const rec = useVoiceRecorder({ maxMs: 30000, onAutoStop });
 *   rec.isRecording / rec.start() / rec.stop() / rec.cancel()
 *   rec.audioBlob / rec.audioBase64 / rec.durationMs / rec.error
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceErrorCode } from './voice-state-machine';

const MAX_MS_DEFAULT = 30_000;

/** Preferred MIME order; first supported wins (R-S08-2). */
const MIME_CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(mime)) return mime;
  }
  return undefined; // let the browser choose its default
}

/** Strip the `data:<mime>;base64,` prefix → naked base64 for POST body. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader result not a string'));
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export interface UseVoiceRecorderOptions {
  /** Auto-stop threshold (default 30000ms per mockup state-A). */
  maxMs?: number;
  /** Fired when auto-stop fires (parent transitions listening→transcribing). */
  onAutoStop?: () => void;
}

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  /** Request mic permission + begin recording. Sets error on permission denial. */
  start: () => Promise<void>;
  /** Stop recording → produces audioBlob + audioBase64. */
  stop: () => void;
  /** Abort recording, discard data (X cancel in state-A). */
  cancel: () => void;
  audioBlob: Blob | null;
  audioBase64: string | null;
  durationMs: number;
  /** FE-side error code (E_PERMISSION_DENIED / E_NO_SPEECH) or null. */
  error: VoiceErrorCode | null;
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  const { maxMs = MAX_MS_DEFAULT, onAutoStop } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<VoiceErrorCode | null>(null);

  // Refs survive re-renders + StrictMode double-mount.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const onAutoStopRef = useRef<typeof onAutoStop>(onAutoStop);
  onAutoStopRef.current = onAutoStop;

  const clearTimers = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setAudioBase64(null);
    setDurationMs(0);
    chunksRef.current = [];
    cancelledRef.current = false;

    // Just-in-time permission gate (§2.3).
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('E_PERMISSION_DENIED');
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      clearTimers();
      teardownStream();
      setIsRecording(false);

      if (cancelledRef.current) {
        chunksRef.current = [];
        return;
      }

      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(elapsed);

      const blob = new Blob(chunksRef.current, {
        type: mimeType ?? 'audio/webm',
      });
      chunksRef.current = [];

      // E_NO_SPEECH guard: <0.5s or empty audio (§2.3).
      if (elapsed < 500 || blob.size === 0) {
        setError('E_NO_SPEECH');
        return;
      }

      setAudioBlob(blob);
      try {
        const b64 = await blobToBase64(blob);
        setAudioBase64(b64);
      } catch {
        setError('E_TRANSCRIBE_FAILED');
      }
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setIsRecording(true);

    // Tick for the live timer (mockup state-A mono "0:04").
    tickTimerRef.current = setInterval(() => {
      setDurationMs(Date.now() - startedAtRef.current);
    }, 200);

    // Auto-stop at maxMs.
    autoStopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
        onAutoStopRef.current?.();
      }
    }, maxMs);
  }, [clearTimers, teardownStream, maxMs]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop(); // → onstop builds blob + base64
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    } else {
      clearTimers();
      teardownStream();
      setIsRecording(false);
    }
    setAudioBlob(null);
    setAudioBase64(null);
    setDurationMs(0);
  }, [clearTimers, teardownStream]);

  // StrictMode-safe cleanup on real unmount.
  useEffect(() => {
    return () => {
      clearTimers();
      teardownStream();
    };
  }, [clearTimers, teardownStream]);

  return {
    isRecording,
    start,
    stop,
    cancel,
    audioBlob,
    audioBase64,
    durationMs,
    error,
  };
}
