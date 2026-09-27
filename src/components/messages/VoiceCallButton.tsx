import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { canCallUser, getOtherParticipant } from "@/services/VoiceCallService";

interface VoiceCallButtonProps {
  threadId: string;
  otherUserId?: string | null;
  otherUserName?: string | null;
  className?: string;
}

/**
 * Call button for a one-to-one chat. Shows only when the server says both
 * people may call each other (feature on for both + shared conversation).
 */
export default function VoiceCallButton({ threadId, otherUserId, otherUserName, className }: VoiceCallButtonProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const voice = useVoiceCall();
  const [peer, setPeer] = useState<string | null>(otherUserId ?? null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    const me = user?.id;
    if (!me) return;
    (async () => {
      const other = otherUserId ?? (await getOtherParticipant(threadId, me));
      if (cancelled || !other) return;
      setPeer(other);
      const ok = await canCallUser(me, other);
      if (!cancelled) setAllowed(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, otherUserId, user?.id]);

  if (!voice || !allowed || !peer) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className={className ?? "gap-1 px-2 md:px-3"}
      disabled={voice.phase !== "idle"}
      aria-label={t("voiceCall.call", "Call")}
      onClick={() => void voice.startCall({ threadId, peerId: peer, peerName: otherUserName ?? undefined })}
    >
      <Phone className="h-4 w-4" />
      <span className="hidden md:inline">{t("voiceCall.call", "Call")}</span>
    </Button>
  );
}
