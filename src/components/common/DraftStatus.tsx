import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toneClasses } from "@/lib/statusTokens";

/**
 * Subtle auto-save status + inactivity countdown shown near a form footer.
 *
 * Derives a "minutes remaining" value from `savedAt`/`expiresAt` with a
 * lightweight 30s interval that only updates a single local state slot —
 * it never re-renders the parent form. Switches to a warning tone under
 * 5 minutes. When `expired` is set (the hook found an already-expired draft
 * on mount) it shows the expiry notice instead of the countdown.
 *
 * The optional "Clear draft" action calls `onClear` (which must call the
 * hook's `clearDraft` and reset the form fields). It never touches any
 * case/submission record.
 */
interface DraftStatusProps {
  savedAt: number | null;
  expiresAt: number | null;
  expired: boolean;
  onClear?: () => void;
}

const WARN_THRESHOLD_MS = 5 * 60 * 1000;

export function DraftStatus({ savedAt, expiresAt, expired, onClear }: DraftStatusProps) {
  const { t } = useTranslation("dashboard");
  const [now, setNow] = useState(() => Date.now());

  // Tick every 30s — only this small state updates, not the parent form.
  useEffect(() => {
    if (expired || savedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [expired, savedAt]);

  if (expired) {
    return (
      <div className={`flex items-center gap-1.5 text-xs ${toneClasses("payment").text}`}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>{t("common.draft.expiredBody", "Your saved draft expired after 30 minutes of inactivity.")}</span>
      </div>
    );
  }

  if (savedAt === null || expiresAt === null) return null;

  const remaining = Math.max(0, expiresAt - now);
  const minutes = Math.ceil(remaining / 60_000);
  const soon = remaining <= WARN_THRESHOLD_MS;
  const soonText = toneClasses("payment").text;

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        {soon ? (
          <Clock className={`h-3.5 w-3.5 shrink-0 ${soonText}`} />
        ) : (
          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${toneClasses("paid").text}`} />
        )}
        <span className={soon ? soonText : ""}>
          {t("common.draft.autoSaved", "Auto-saved")} ·{" "}
          {t(
            soon ? "common.draft.expiringSoon" : "common.draft.expiresIn",
            "Expires in {{minutes}} min",
            { minutes },
          )}
        </span>
      </div>
      {onClear && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto py-0.5 px-1.5 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (window.confirm(t("common.draft.clearDraftConfirm", "Clear the saved draft? Your typed changes will be lost."))) {
              onClear();
            }
          }}
        >
          <Trash2 className="h-3 w-3 me-1" />
          {t("common.draft.clearDraft", "Clear draft")}
        </Button>
      )}
    </div>
  );
}

export default DraftStatus;
