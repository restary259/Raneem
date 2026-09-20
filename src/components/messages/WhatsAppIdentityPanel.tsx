import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Link2Off, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getIdentitySuggestions,
  linkWhatsAppIdentity,
  unlinkWhatsAppIdentity,
  type IdentitySuggestion,
  type WhatsAppLead,
} from "@/services/WhatsAppService";

/**
 * Identity bridge UI. Exact phone matches may already be linked automatically
 * by the ingest pipeline. Unresolved suggestions remain explicit staff actions.
 */
export default function WhatsAppIdentityPanel({ lead, onChanged }: { lead: WhatsAppLead; onChanged: () => void }) {
  const { t } = useTranslation("whatsapp");
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<IdentitySuggestion[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const linked = Boolean(lead.linked_case_id || lead.linked_lead_id || lead.linked_profile_id);

  const load = useCallback(() => {
    if (linked) { setSuggestions([]); return; }
    getIdentitySuggestions(lead.id).then(setSuggestions).catch(() => setSuggestions([]));
  }, [lead.id, linked]);

  useEffect(() => { setDismissed([]); load(); }, [load]);

  const confirm = async (suggestion: IdentitySuggestion) => {
    setBusy(true);
    try {
      await linkWhatsAppIdentity(lead.id, {
        case_id: suggestion.case_id ?? undefined,
        lead_id: suggestion.lead_id ?? undefined,
        profile_id: suggestion.profile_id ?? undefined,
      });
      toast({ description: t("identity.linked") });
      onChanged();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    } finally { setBusy(false); }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await unlinkWhatsAppIdentity(lead.id);
      toast({ description: t("identity.unlinked") });
      onChanged();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    } finally { setBusy(false); }
  };

  if (linked) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b bg-emerald-500/5 px-3 py-2 text-xs">
        <UserCheck className="h-4 w-4 text-emerald-600" />
        <span className="font-medium">{t("identity.linkedTitle")}</span>
        <Badge variant="outline" className="gap-1">
          {lead.linked_case_id ? t("identity.kind.case") : lead.linked_profile_id ? t("identity.kind.profile") : t("identity.kind.lead")}
        </Badge>
        <Badge variant="secondary">{lead.identity_confirmed_by ? t("identity.staffConfirmed") : t("identity.autoLinked")}</Badge>
        <Button size="sm" variant="ghost" className="ms-auto" disabled={busy} onClick={() => void unlink()}>
          <Link2Off className="me-1.5 h-3.5 w-3.5" />{t("identity.unlink")}
        </Button>
      </div>
    );
  }

  const visible = suggestions.filter((item) => !dismissed.includes(item.match_kind + ":" + item.match_id));
  if (!visible.length) return null;

  return (
    <div className="space-y-2 border-b bg-amber-500/5 px-3 py-2 text-xs">
      <p className="font-medium">{t("identity.suggestionTitle")}</p>
      {visible.map((item) => (
        <div key={item.match_kind + ":" + item.match_id} className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`identity.kind.${item.match_kind}`, item.match_kind)}</Badge>
          <span className="font-medium">{item.display_name || t("identity.noName")}</span>
          {item.detail && <span className="text-muted-foreground">{item.detail}</span>}
          <span className="ms-auto flex gap-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void confirm(item)}>
              <Link2 className="me-1.5 h-3.5 w-3.5" />{t("identity.confirm")}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDismissed((current) => [...current, item.match_kind + ":" + item.match_id])}>
              {t("identity.dismiss")}
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}
