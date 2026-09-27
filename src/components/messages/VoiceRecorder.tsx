import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Play, Send, Square, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  formatVoiceDuration,
  MAX_VOICE_DURATION_MS,
  normalizeVoiceMime,
  validateVoiceRecording,
} from "@/lib/chatFormat";
const RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

type RecorderMode = "idle" | "recording" | "preview" | "sending";

interface VoiceRecorderProps {
  disabled?: boolean;
  className?: string;
  maxDurationMs?: number;
  onSend: (file: File, durationMs: number) => Promise<void>;
  onActiveChange?: (active: boolean) => void;
}

function supportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return RECORDING_MIME_CANDIDATES.find(function (mime) {
    return MediaRecorder.isTypeSupported(mime);
  }) || "";
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

const BARS = Array.from({ length: 28 }, function (_, index) {
  const wave = Math.abs(Math.sin(index * 1.73) * 0.62 + Math.cos(index * 0.47) * 0.28);
  return 0.3 + Math.min(0.7, wave);
});

export default function VoiceRecorder({
  disabled = false,
  className,
  maxDurationMs = MAX_VOICE_DURATION_MS,
  onSend,
  onActiveChange,
}: VoiceRecorderProps) {
  const { t } = useTranslation("dashboard");
  const [mode, setMode] = useState<RecorderMode>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingPreview, setPlayingPreview] = useState(false);

  const modeRef = useRef<RecorderMode>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelBeforeReadyRef = useRef(false);
  const previewOnStopRef = useRef(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const unmountedRef = useRef(false);
  const startRequestRef = useRef(0);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const lastControlActionAtRef = useRef(0);

  const isActive = mode !== "idle";

  const setRecorderMode = function (next: RecorderMode) {
    modeRef.current = next;
    setMode(next);
    onActiveChange?.(next !== "idle");
  };

  const stopStream = function () {
    streamRef.current?.getTracks().forEach(function (track) {
      track.stop();
    });
    streamRef.current = null;
  };

  const clearPreview = function () {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
    }
    setRecordedUrl(null);
    setRecordedFile(null);
    setPlayingPreview(false);
  };

  const reset = function (errorMessage?: string) {
    startRequestRef.current += 1;
    startingRef.current = false;
    if (unmountedRef.current) {
      chunksRef.current = [];
      recorderRef.current = null;
      stopStream();
      return;
    }
    clearPreview();
    chunksRef.current = [];
    recorderRef.current = null;
    stoppingRef.current = false;
    cancelBeforeReadyRef.current = false;
    previewOnStopRef.current = false;
    setElapsedMs(0);
    setError(errorMessage ?? null);
    stopStream();
    setRecorderMode("idle");
  };

  useEffect(function () {
    return function () {
      unmountedRef.current = true;
      cancelBeforeReadyRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(function () {
    return function () {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  useEffect(function () {
    if (mode !== "recording") return;
    const timer = window.setInterval(function () {
      if (!startedAtRef.current) return;
      const next = Date.now() - startedAtRef.current;
      if (next >= maxDurationMs) {
        setElapsedMs(maxDurationMs);
        previewOnStopRef.current = true;
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive" && !stoppingRef.current) {
          stoppingRef.current = true;
          recorder.stop();
        }
        return;
      }
      setElapsedMs(next);
    }, 100);
    return function () {
      window.clearInterval(timer);
    };
  }, [mode, maxDurationMs]);

  const finalizeRecording = async function (requestId: number, recorder: MediaRecorder) {
    if (requestId !== startRequestRef.current || unmountedRef.current) {
      stopStream();
      return;
    }
    stoppingRef.current = false;
    if (cancelBeforeReadyRef.current) {
      reset();
      return;
    }

    const rawMime = recorder.mimeType || supportedMimeType() || "audio/webm";
    const normalizedMime = normalizeVoiceMime(rawMime);
    const blob = new Blob(chunksRef.current, {
      type: normalizedMime,
    });
    chunksRef.current = [];
    recorderRef.current = null;
    stopStream();

    const durationMs = Math.min(
      maxDurationMs,
      Math.max(250, Date.now() - startedAtRef.current),
    );
    setElapsedMs(durationMs);

    if (blob.size === 0) {
      reset(t("chat.voice.error.empty"));
      return;
    }

    const file = new File([blob], "voice-" + Date.now() + "." + extensionForMime(normalizedMime), {
      type: normalizedMime,
      lastModified: Date.now(),
    });
    const invalid = validateVoiceRecording(file, durationMs);
    if (invalid) {
      reset(
        invalid === "duration"
          ? t("chat.voice.error.duration")
          : invalid === "size"
            ? t("chat.voice.error.size")
            : t("chat.voice.error.format"),
      );
      return;
    }

    if (previewOnStopRef.current) {
      setRecordedFile(file);
      setRecordedUrl(URL.createObjectURL(file));
      setPlayingPreview(false);
      previewOnStopRef.current = false;
      setRecorderMode("preview");
      return;
    }

    setRecorderMode("sending");
    try {
      await onSend(file, durationMs);
      if (!unmountedRef.current) reset();
    } catch (err: any) {
      setRecordedFile(file);
      setRecordedUrl(URL.createObjectURL(file));
      setError(err?.message || t("chat.voice.error.upload"));
      setRecorderMode("preview");
    }
  };

  const stopRecording = function (preview: boolean) {
    if (stoppingRef.current) return;
    previewOnStopRef.current = preview;
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }
    if (recorder.state !== "inactive") {
      stoppingRef.current = true;
      recorder.stop();
    }
  };

  const cancelRecording = function () {
    cancelBeforeReadyRef.current = true;
    previewOnStopRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      if (stoppingRef.current) return;
      stoppingRef.current = true;
      recorder.stop();
    } else {
      reset();
    }
  };

  const startRecording = async function () {
    if (disabled || isActive || modeRef.current !== "idle" || startingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("chat.voice.error.unsupported"));
      return;
    }

    startingRef.current = true;
    const requestId = startRequestRef.current + 1;
    startRequestRef.current = requestId;
    cancelBeforeReadyRef.current = false;
    setError(null);
    clearPreview();

    const mimeType = supportedMimeType();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      startingRef.current = false;
      if (requestId !== startRequestRef.current || cancelBeforeReadyRef.current) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
        return;
      }
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType } : undefined);

      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      stoppingRef.current = false;
      cancelBeforeReadyRef.current = false;
      previewOnStopRef.current = false;
      setRecorderMode("recording");

      recorder.addEventListener("dataavailable", function (event) {
        if (
          requestId === startRequestRef.current &&
          !cancelBeforeReadyRef.current &&
          event.data.size > 0
        ) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener(
        "stop",
        function () {
          void finalizeRecording(requestId, recorder);
        },
        { once: true },
      );

      recorder.start(250);

    } catch (err: any) {
      startingRef.current = false;
      stopStream();
      const name = err?.name;
      setError(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? t("chat.voice.error.permission")
          : t("chat.voice.error.unavailable"),
      );
      setRecorderMode("idle");
    }
  };

  const togglePreview = async function () {
    const audio = audioPreviewRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlayingPreview(true);
      } catch {
        setError(t("chat.voice.error.playback"));
      }
    } else {
      audio.pause();
      setPlayingPreview(false);
    }
  };

  const sendPreview = async function () {
    if (!recordedFile || mode === "sending") return;
    setError(null);
    setRecorderMode("sending");
    try {
      await onSend(recordedFile, elapsedMs);
      reset();
    } catch (err: any) {
      setError(err?.message || t("chat.voice.error.upload"));
      setRecorderMode("preview");
    }
  };

  if (mode === "sending") {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border bg-background px-3 py-2",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">{t("chat.voice.sending")}</span>
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className={cn("flex min-w-0 items-center gap-1", className)}>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("chat.voice.record")}
          title={t("chat.voice.recordHint")}
          onClick={function () {
            void startRecording();
          }}
          onContextMenu={function (event) {
            event.preventDefault();
          }}
          className="flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
        >
          <Mic className="h-[18px] w-[18px]" />
        </button>
        {error && (
          <span className="max-w-[220px] truncate text-[10px] text-destructive" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-2xl border bg-background px-2.5 py-1.5",
        mode === "recording" && "border-destructive/30 bg-destructive/[0.03]",
        className,
      )}
    >
      {mode === "recording" ? (
        <>
          <button
            type="button"
            aria-label={t("chat.voice.cancel")}
            title={t("chat.voice.cancel")}
            onPointerDown={function (event) {
              event.preventDefault();
              event.stopPropagation();
              lastControlActionAtRef.current = Date.now();
              cancelRecording();
            }}
            onClick={function (event) {
              event.stopPropagation();
              if (Date.now() - lastControlActionAtRef.current < 500) return;
              cancelRecording();
            }}
            className="relative z-10 flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              {formatVoiceDuration(elapsedMs)}
            </span>
            <div className="flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
              {BARS.map(function (height, index) {
                return (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="flex-1 rounded-full bg-destructive/35"
                    style={{ height: Math.round(height * 24) + "px" }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label={t("chat.voice.stop")}
                title={t("chat.voice.stop")}
                onPointerDown={function (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  lastControlActionAtRef.current = Date.now();
                  stopRecording(true);
                }}
                onClick={function (event) {
                  event.stopPropagation();
                  if (Date.now() - lastControlActionAtRef.current < 500) return;
                  stopRecording(true);
                }}
                className="relative z-10 flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
              <button
                type="button"
                aria-label={t("chat.voice.send")}
                title={t("chat.voice.send")}
                onPointerDown={function (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  lastControlActionAtRef.current = Date.now();
                  stopRecording(false);
                }}
                onClick={function (event) {
                  event.stopPropagation();
                  if (Date.now() - lastControlActionAtRef.current < 500) return;
                  stopRecording(false);
                }}
                className="relative z-10 flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            aria-label={t("chat.voice.delete")}
            onClick={function () { reset(); }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label={playingPreview ? t("chat.voice.pause") : t("chat.voice.play")}
            onClick={function () {
              void togglePreview();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            {playingPreview ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex h-7 items-center gap-0.5 overflow-hidden">
              {BARS.map(function (height, index) {
                return (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="flex-1 rounded-full bg-primary/35"
                    style={{ height: Math.round(height * 20) + "px" }}
                  />
                );
              })}
            </div>
            {error && (
              <p className="truncate text-[10px] text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatVoiceDuration(elapsedMs)}
          </span>

          <Button
            type="button"
            size="icon"
            aria-label={t("chat.voice.send")}
            onClick={function () {
              void sendPreview();
            }}
            className="h-8 w-8 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </>
      )}

      {recordedUrl && (
        <audio
          ref={audioPreviewRef}
          src={recordedUrl}
          preload="metadata"
          onEnded={function () {
            setPlayingPreview(false);
          }}
          className="hidden"
        />
      )}
      {(mode as string) === "sending" && <span className="sr-only">{t("chat.voice.sending")}</span>}
    </div>
  );
}
