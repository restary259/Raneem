import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getAttachmentUrl } from "@/services/ChatAttachmentService";
import type { ChatAttachment } from "@/lib/chatFormat";

let activeAudio: HTMLAudioElement | null = null;

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return String(minutes) + ":" + String(safe % 60).padStart(2, "0");
}

const WAVEFORM = Array.from({ length: 30 }, function (_, index) {
  const value = Math.abs(Math.sin(index * 1.31) * 0.6 + Math.cos(index * 0.59) * 0.25);
  return 0.3 + Math.min(0.7, value);
});

export default function VoiceMessage({
  att,
  mine = false,
}: {
  att: ChatAttachment;
  mine?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState((att.durationMs ?? 0) / 1000);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(function () {
    const onExternalPause = function (event: Event) {
      const custom = event as CustomEvent<HTMLAudioElement>;
      if (custom.detail === audioRef.current) setPlaying(false);
    };
    window.addEventListener("darb:voice-pause", onExternalPause);
    return function () {
      window.removeEventListener("darb:voice-pause", onExternalPause);
      if (audioRef.current === activeAudio) {
        audioRef.current.pause();
        activeAudio = null;
      }
    };
  }, []);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const playedBars = Math.round(progress * WAVEFORM.length);
  const timeLabel = useMemo(
    function () {
      return formatDuration(playing ? currentTime : duration);
    },
    [currentTime, duration, playing],
  );

  const toggle = async function () {
    if (failed) return;

    if (!url) {
      setLoading(true);
      try {
        const signedUrl = await getAttachmentUrl(att.path);
        setUrl(signedUrl);
      } catch {
        setFailed(true);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    let audio = audioRef.current;
    if (!audio) {
      const sourceUrl = url || await getAttachmentUrl(att.path);
      audio = new Audio(sourceUrl);
      audio.preload = "metadata";
      audioRef.current = audio;

      audio.addEventListener("loadedmetadata", function () {
        if (Number.isFinite(audio?.duration) && audio && audio.duration > 0) {
          setDuration(audio.duration);
        }
      });
      audio.addEventListener("timeupdate", function () {
        if (audio) setCurrentTime(audio.currentTime);
      });
      audio.addEventListener("ended", function () {
        setPlaying(false);
        setCurrentTime(0);
        if (activeAudio === audio) activeAudio = null;
      });
      audio.addEventListener("error", function () {
        setFailed(true);
        setPlaying(false);
        if (activeAudio === audio) activeAudio = null;
      });
    }

    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
      window.dispatchEvent(new CustomEvent<HTMLAudioElement>("darb:voice-pause", { detail: activeAudio }));
    }

    if (audio.paused) {
      setLoading(true);
      try {
        await audio.play();
        activeAudio = audio;
        setPlaying(true);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
      if (activeAudio === audio) activeAudio = null;
    }
  };

  const seek = function (event: ReactMouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = next * duration;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div
      className={cn(
        "flex w-[min(300px,70vw)] items-center gap-2",
        mine ? "text-primary-foreground" : "text-foreground",
      )}
    >
      <button
        type="button"
        onClick={function () {
          void toggle();
        }}
        aria-label={playing ? t("chat.voice.pause") : t("chat.voice.play")}
        disabled={!url || failed}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label={t("chat.voice.progress")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={seek}
          onKeyDown={function (event) {
            const audio = audioRef.current;
            if (!audio || duration <= 0) return;
            if (event.key === "ArrowRight") {
              event.preventDefault();
              audio.currentTime = Math.min(duration, audio.currentTime + 5);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              audio.currentTime = Math.max(0, audio.currentTime - 5);
            }
          }}
          className="flex h-7 cursor-pointer items-center gap-0.5 overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {WAVEFORM.map(function (height, index) {
            return (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  "flex-1 rounded-full transition-colors",
                  mine
                    ? index < playedBars
                      ? "bg-primary-foreground"
                      : "bg-primary-foreground/35"
                    : index < playedBars
                      ? "bg-primary"
                      : "bg-foreground/25",
                )}
                style={{ height: Math.round(height * 20) + "px" }}
              />
            );
          })}
        </div>
        <div
          className={cn(
            "flex justify-end text-[10px] tabular-nums",
            mine ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {timeLabel}
        </div>
      </div>
    </div>
  );
}
