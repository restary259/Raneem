import { supabase } from '@/integrations/supabase/client';

export const PARTNER_CASE_SOURCES = [
  'apply_page',
  'contact_form',
  'submit_new_student',
  'manual',
];

export type ResolvedPartnerVisibilityMode = 'all_cases' | 'partner_sources' | 'referral_only';

export interface PartnerVisibilityOverride {
  partner_id?: string;
  commission_amount?: number;
  show_all_cases?: boolean | null;
  visibility_mode?: string | null;
}

export function resolvePartnerVisibilityMode(
  override: PartnerVisibilityOverride | null | undefined,
  globalShowAll: boolean,
): ResolvedPartnerVisibilityMode {
  if (
    override?.visibility_mode === 'all_cases'
    || override?.visibility_mode === 'partner_sources'
    || override?.visibility_mode === 'referral_only'
  ) {
    return override.visibility_mode;
  }

  // Legacy boolean fallback. Legacy NULL means no visibility override, not a
  // hidden referral-only mode; commission-only rows must follow the global default.
  if (override?.show_all_cases === true) return 'all_cases';
  if (override?.show_all_cases === false) return 'partner_sources';
  return globalShowAll ? 'all_cases' : 'partner_sources';
}

export function resolveVisibilitySources(
  override: PartnerVisibilityOverride | null | undefined,
  globalShowAll: boolean,
): string[] | null {
  const mode = resolvePartnerVisibilityMode(override, globalShowAll);
  if (mode === 'all_cases') return null;
  if (mode === 'referral_only') return ['referral'];
  return [...PARTNER_CASE_SOURCES];
}

/**
 * Reads the legacy columns first so a frontend-first deploy still works before
 * the visibility_mode migration exists. The explicit mode is a second,
 * error-tolerant lookup; if it is unavailable, the legacy fallback remains valid.
 */
export async function fetchPartnerVisibilityOverride(
  partnerId: string,
): Promise<PartnerVisibilityOverride | null> {
  const { data: legacyRow, error: legacyError } = await supabase
    .from('partner_commission_overrides')
    .select('partner_id,commission_amount,show_all_cases')
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (legacyError) return null;
  let row: PartnerVisibilityOverride | null = legacyRow ?? null;

  const { data: modeRow, error: modeError } = await supabase
    .from('partner_commission_overrides')
    .select('visibility_mode')
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (!modeError && modeRow) {
    row = { ...(row ?? { partner_id: partnerId }), visibility_mode: modeRow.visibility_mode };
  }

  return row;
}
