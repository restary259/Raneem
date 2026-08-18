import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIls, type VariableMap } from "@/lib/documentBlocks";

interface PlatformSettings {
  agent_commission_rate: number;
  agent_self_referral_rate: number;
  ambassador_commission_rate: number;
  partner_commission_rate: number;
}

export interface DocumentMeta {
  current_version: string;
  effective_date: string | null;
}

/**
 * Resolves the DARB document `{{tokens}}` (the keys in VARIABLE_KEYS) from the
 * live Commission Hub configuration, so the operations guides can never drift
 * from the system they document. Money figures are flat ₪ amounts (DARB
 * commissions are never percentages), formatted via `formatIls`.
 *
 * Contextual tokens (recipient_name / agent_name / student_name / partner_name
 * / date) are left unresolved on purpose — they are supplied per-recipient at
 * preview/print time, never read from platform_settings.
 */
export function useDocumentVariables(meta?: DocumentMeta | null) {
  const [vars, setVars] = useState<VariableMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("agent_commission_rate, agent_self_referral_rate, ambassador_commission_rate, partner_commission_rate")
          .limit(1)
          .single();
        if (error) throw error;
        if (!active) return;
        const s = data as PlatformSettings | null;
        const map: VariableMap = {
          agent_recruitment_amount: formatIls(s?.agent_commission_rate ?? 0),
          agent_self_referral_amount: formatIls(s?.agent_self_referral_rate ?? 0),
          partner_amount: formatIls(s?.partner_commission_rate ?? 0),
          ambassador_amount: formatIls(s?.ambassador_commission_rate ?? 0),
          lock_days: "20",
        };
        if (meta?.current_version) map.version = meta.current_version;
        if (meta?.effective_date) {
          const d = new Date(meta.effective_date);
          if (!Number.isNaN(d.getTime())) {
            map.effective_date = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
          }
        }
        setVars(map);
      } catch {
        if (!active) return;
        // Fall back to the hardcoded business rule so the guide is still readable.
        setVars({ lock_days: "20", ...(meta?.current_version ? { version: meta.current_version } : {}) });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [meta?.current_version, meta?.effective_date]);

  return { variables: vars, loading };
}

export default useDocumentVariables;
