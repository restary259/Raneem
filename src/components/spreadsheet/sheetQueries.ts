import { supabase } from '@/integrations/supabase/client';

export interface SheetScope {
  /** 'admin' sees everything, 'team' only their own rows */
  scope: 'admin' | 'team';
  userId?: string;
}

const staffNameMap = async (): Promise<Record<string, { name: string; role: string }>> => {
  const { data } = await (supabase as any).rpc('get_staff_directory');
  const map: Record<string, { name: string; role: string }> = {};
  (data || []).forEach((s: any) => {
    map[s.id] = { name: s.full_name, role: s.role };
  });
  return map;
};

/**
 * Fallback name resolver for user IDs that get_staff_directory excludes. That RPC is
 * visibility-restricted (admins/managers only) and only returns team_member/admin/
 * social_media_partner roles — so a non-manager team member calling it gets back an
 * empty/limited set and their own name (and ambassador/referrer names) render as "—".
 * resolve_profile_names is a SECURITY DEFINER RPC returning (id, full_name) for any
 * non-deleted profile, granted to authenticated. We only resolve IDs missing from the
 * staff map to keep the extra round-trip small.
 */
const resolveProfileNames = async (ids: string[]): Promise<Record<string, string>> => {
  if (ids.length === 0) return {};
  const { data } = await (supabase as any).rpc('resolve_profile_names', { p_ids: ids });
  const map: Record<string, string> = {};
  (data || []).forEach((p: any) => {
    map[p.id] = p.full_name;
  });
  return map;
};

/** Resolve the display name for any user ID, falling back to resolve_profile_names. */
const resolveNames = async (
  ids: string[],
  staff: Record<string, { name: string; role: string }>,
): Promise<Record<string, string>> => {
  const missing = ids.filter((id) => id && !staff[id]);
  const resolved = await resolveProfileNames(missing);
  const out: Record<string, string> = {};
  for (const id of ids) {
    if (!id) continue;
    out[id] = staff[id]?.name ?? resolved[id] ?? null;
  }
  return out;
};

const throwIf = (error: any) => {
  if (error) throw error;
};

/* ---------------------------------- Students --------------------------------- */

/** Snapshot price first, catalog price as fallback for rows saved before pricing existed. */
const priceOf = (snapshot: unknown, catalog: unknown): number => {
  const snap = Number(snapshot ?? 0);
  if (snap > 0) return snap;
  return Number(catalog ?? 0) || 0;
};

/**
 * Agency (shekel) fee per case. The submission column is frequently 0 because
 * the fee lives on `case_services`, so the service lines are the source of
 * truth and the submission column is only a fallback.
 */
const serviceFeeByCase = async (caseIds: string[]): Promise<Record<string, number>> => {
  const map: Record<string, number> = {};
  if (caseIds.length === 0) return map;
  const { data } = await (supabase as any)
    .from('case_services')
    .select('case_id, unit_price, quantity, discount')
    .in('case_id', caseIds);
  (data || []).forEach((s: any) => {
    const line = Number(s.unit_price ?? 0) * Number(s.quantity ?? 1) - Number(s.discount ?? 0);
    map[s.case_id] = (map[s.case_id] ?? 0) + line;
  });
  return map;
};

export const fetchStudentsSheet = async ({ scope, userId }: SheetScope) => {
  const staff = await staffNameMap();

  let query = (supabase as any)
    .from('case_submissions')
    .select(`
      id, program_start_date, program_end_date, extra_data, school_id,
      program_price, accommodation_price, insurance_price,
      service_fee, total_paid, remaining_balance, enrollment_paid_at,
      student_email, student_phone,
      case:cases!inner(id, case_reference, full_name, phone_number, city, status, assigned_to, partner_id, education_level, passport_type),
      school:schools(id, name_en, name_ar),
      program:programs(name_en, name_ar, price),
      accommodation:accommodations(name_en, name_ar, price),
      insurance:insurances(name, price)
    `)
    .is('deleted_at', null);


  if (scope === 'team' && userId) query = query.eq('case.assigned_to', userId);

  const { data, error } = await query;
  throwIf(error);

  const rows = data || [];
  const fees = await serviceFeeByCase(
    Array.from(new Set(rows.map((s: any) => s.case?.id).filter(Boolean))) as string[],
  );
  const names = await resolveNames(
    Array.from(new Set(
      rows.map((s: any) => [s.case?.assigned_to, s.case?.partner_id]).flat().filter(Boolean),
    )) as string[],
    staff,
  );

  return rows.map((s: any) => {
    const extra = s.extra_data ?? {};
    const programPrice = priceOf(s.program_price, s.program?.price);
    const accommodationPrice = priceOf(s.accommodation_price, s.accommodation?.price);
    const insurancePrice = priceOf(s.insurance_price, s.insurance?.price);
    return {
      id: s.id,
      case_reference: s.case?.case_reference ?? null,
      full_name: s.case?.full_name ?? '—',
      phone: s.case?.phone_number ?? s.student_phone ?? null,
      // Schools need identity data that only lives on the submission payload.
      email: s.student_email ?? extra.email ?? null,
      date_of_birth: extra.date_of_birth ?? extra.dob ?? null,
      passport_number: extra.passport_number ?? null,
      passport_type: s.case?.passport_type ?? extra.passport_type ?? null,
      education_level: s.case?.education_level ?? extra.education_level ?? null,
      city: s.case?.city ?? extra.city ?? null,
      status: s.case?.status ?? null,

      team_member: names[s.case?.assigned_to] ?? null,
      partner: names[s.case?.partner_id] ?? null,
      // Real relationship — never a free-text fallback.
      school_id: s.school_id ?? s.school?.id ?? null,
      school_name: s.school?.name_en ?? s.school?.name_ar ?? null,
      program_name: s.program?.name_en ?? s.program?.name_ar ?? null,
      accommodation_name: s.accommodation?.name_en ?? s.accommodation?.name_ar ?? null,
      insurance_name: s.insurance?.name ?? null,
      intake_month: extra.start_month ?? (s.program_start_date ? s.program_start_date.slice(0, 7) : null),
      course_start: s.program_start_date,
      course_end: s.program_end_date,
      program_price: programPrice,
      accommodation_price: accommodationPrice,
      insurance_price: insurancePrice,
      // Euro school costs only — the agency fee is billed separately in shekels.
      total: programPrice + accommodationPrice + insurancePrice,
      service_fee: fees[s.case?.id] ?? Number(s.service_fee ?? 0) ?? 0,
    };
  });
};

/* ---------------------------------- Payments --------------------------------- */

export const fetchPaymentsSheet = async () => {
  const staff = await staffNameMap();

  // Authoritative DARB (ILS) payments from case_payments — the same source
  // get_case_financials uses. The legacy case_submissions money columns
  // (service_fee/total_paid/remaining_balance) are no longer maintained and
  // must not drive exports. RLS scopes team members to their own cases, so no
  // client-side filter is needed here.
  const { data: payments, error } = await (supabase as any)
    .from('case_payments')
    .select('case_id, amount, confirmed_at, confirmed_by')
    .eq('payment_type', 'agency_service')
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false });
  throwIf(error);

  if (!payments || payments.length === 0) return [];

  const caseIds = Array.from(new Set(payments.map((p: any) => p.case_id))) as string[];
  const fees = await serviceFeeByCase(caseIds);

  const { data: subs } = await (supabase as any)
    .from('case_submissions')
    .select(`
      id, program_price, accommodation_price, insurance_price,
      case:cases!inner(id, case_reference, full_name, status)
    `)
    .in('case.id', caseIds)
    .is('deleted_at', null);
  const subByCase = new Map<string, any>((subs || []).map((s: any) => [s.case?.id, s]));
  const names = await resolveNames(
    Array.from(new Set(payments.map((p: any) => p.confirmed_by).filter(Boolean))) as string[],
    staff,
  );

  return (payments || []).map((p: any) => {
    const s: any = subByCase.get(p.case_id);
    const fee = fees[p.case_id] ?? 0;
    const paid = Number(p.amount ?? 0);
    return {
      id: p.case_id,
      case_reference: s?.case?.case_reference ?? null,
      paid_date: p.confirmed_at,
      student: s?.case?.full_name ?? '—',
      service_fee: fee,
      program_price: s?.program_price ?? 0,
      accommodation_price: s?.accommodation_price ?? 0,
      insurance_price: s?.insurance_price ?? 0,
      total_paid: paid,
      remaining_balance: Math.max(fee - paid, 0),
      confirmed_by: names[p.confirmed_by] ?? null,
      status: s?.case?.status ?? null,
    };
  });
};

/* ---------------------------------- Payouts ---------------------------------- */

export const fetchPayoutsSheet = async () => {
  const staff = await staffNameMap();
  const { data, error } = await (supabase as any)
    .from('payout_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  throwIf(error);

  const names = await resolveNames(
    Array.from(new Set((data || []).map((p: any) => p.requestor_id).filter(Boolean))) as string[],
    staff,
  );

  return (data || []).map((p: any) => ({
    id: p.id,
    payout_reference: p.payout_reference ?? null,
    requested_at: p.requested_at,
    paid_at: p.paid_at,
    person: names[p.requestor_id] ?? '—',
    role: p.requestor_role,
    students: (p.linked_student_names || []).join(', '),
    amount: p.amount ?? 0,
    status: p.status,
    payment_method: p.payment_method,
    transaction_ref: p.transaction_ref,
  }));
};

/* -------------------------------- Commissions -------------------------------- */

const LOCK_DAYS = 20;

export const fetchCommissionsSheet = async ({ scope, userId }: SheetScope) => {
  const staff = await staffNameMap();

  let query = (supabase as any)
    .from('rewards')
    .select('*')
    .order('created_at', { ascending: false });

  if (scope === 'team' && userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  throwIf(error);

  const names = await resolveNames(
    Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean))) as string[],
    staff,
  );

  return (data || []).map((r: any) => {
    const notes: string = r.admin_notes ?? '';
    // reward_type is the authoritative classification; notes are free text.
    const kind =
      r.reward_type === 'partner' || r.reward_type === 'team' || r.reward_type === 'master_override'
        ? r.reward_type
        : notes.startsWith('Partner commission')
          ? 'partner'
          : notes.startsWith('Team commission')
            ? 'team'
            : 'other';
    const unlock = new Date(new Date(r.created_at).getTime() + LOCK_DAYS * 86400000);
    return {
      id: r.id,
      created_at: r.created_at,
      person: names[r.user_id] ?? '—',
      kind,
      source: notes || '—',
      amount: r.amount ?? 0,
      status: r.status,
      unlock_date: unlock.toISOString(),
      paid_at: r.paid_at,
    };
  });
};

/* ----------------------------- Schools & Programs ---------------------------- */

export const fetchCatalogSheet = async () => {
  const [programsRes, accRes, insRes, schoolsRes, subsRes] = await Promise.all([
    (supabase as any).from('programs').select('*, school:schools(name_en, city)'),
    (supabase as any).from('accommodations').select('*, school:schools(name_en, city)'),
    (supabase as any).from('insurances').select('*'),
    (supabase as any).from('schools').select('*'),
    (supabase as any).from('case_submissions').select('program_id, accommodation_id, insurance_id').is('deleted_at', null),
  ]);
  throwIf(programsRes.error || accRes.error || insRes.error || schoolsRes.error);

  const subs = subsRes.data || [];
  const count = (field: string, id: string) => subs.filter((s: any) => s[field] === id).length;
  const schools = schoolsRes.data || [];

  const rows: any[] = [];

  (programsRes.data || []).forEach((p: any) => {
    rows.push({
      id: `p-${p.id}`,
      name: p.name_en,
      school: p.school?.name_en ?? null,
      city: p.school?.city ?? null,
      kind: 'program',
      type: p.type,
      duration: p.duration,
      price: p.price ?? 0,
      currency: p.currency,
      active: p.is_active ? 'yes' : 'no',
      students: count('program_id', p.id),
    });
  });

  (accRes.data || []).forEach((a: any) => {
    rows.push({
      id: `a-${a.id}`,
      name: a.name_en,
      school: a.school?.name_en ?? null,
      city: a.school?.city ?? null,
      kind: 'accommodation',
      type: 'accommodation',
      duration: null,
      price: a.price ?? 0,
      currency: a.currency,
      active: a.is_active ? 'yes' : 'no',
      students: count('accommodation_id', a.id),
    });
  });

  (insRes.data || []).forEach((i: any) => {
    rows.push({
      id: `i-${i.id}`,
      name: i.name,
      school: null,
      city: null,
      kind: 'insurance',
      type: i.tier,
      duration: null,
      price: i.price ?? 0,
      currency: i.currency,
      active: i.is_active ? 'yes' : 'no',
      students: count('insurance_id', i.id),
    });
  });

  schools.forEach((s: any) => {
    rows.push({
      id: `s-${s.id}`,
      name: s.name_en,
      school: s.name_en,
      city: s.city,
      kind: 'school',
      type: 'school',
      duration: null,
      price: 0,
      currency: '',
      active: s.is_active ? 'yes' : 'no',
      students: 0,
    });
  });

  return rows;
};

/* ----------------------------------- Taxes ----------------------------------- */

export const fetchTaxSheet = async () => {
  const { data, error } = await (supabase as any).rpc('get_monthly_tax_report');
  throwIf(error);
  return (data || []).map((r: any) => ({
    id: r.month,
    month: r.month,
    gross_collected: Number(r.gross_collected) || 0,
    vat_amount: Number(r.vat_amount) || 0,
    net_before_vat: Number(r.net_before_vat) || 0,
    commissions_paid: Number(r.commissions_paid) || 0,
    net_margin: Number(r.net_margin) || 0,
    transactions_count: Number(r.transactions_count) || 0,
  }));
};

/* ------------------------------ Team performance ----------------------------- */

const ENROLLED = 'enrollment_paid';

export const fetchPerformanceSheet = async ({ scope, userId }: SheetScope) => {
  const staff = await staffNameMap();

  let casesQuery = (supabase as any)
    .from('cases')
    .select('id, status, assigned_to')
    .is('deleted_at', null);
  if (scope === 'team' && userId) casesQuery = casesQuery.eq('assigned_to', userId);

  let rewardsQuery = (supabase as any).from('rewards').select('user_id, amount, status, admin_notes, reward_type');
  if (scope === 'team' && userId) rewardsQuery = rewardsQuery.eq('user_id', userId);

  const [casesRes, rewardsRes] = await Promise.all([casesQuery, rewardsQuery]);
  throwIf(casesRes.error || rewardsRes.error);

  const cases = casesRes.data || [];
  const rewards = (rewardsRes.data || []).filter((r: any) =>
    r.reward_type ? r.reward_type === 'team' : (r.admin_notes ?? '').startsWith('Team commission'),
  );

  const ids = Array.from(
    new Set([
      ...cases.map((c: any) => c.assigned_to).filter(Boolean),
      ...rewards.map((r: any) => r.user_id),
    ]),
  ) as string[];

  const names = await resolveNames(ids, staff);

  return ids.map(id => {
    const mine = cases.filter((c: any) => c.assigned_to === id);
    const enrolled = mine.filter((c: any) => c.status === ENROLLED).length;
    const contacted = mine.filter((c: any) => c.status !== 'new').length;
    const myRewards = rewards.filter((r: any) => r.user_id === id);
    return {
      id,
      person: names[id] ?? '—',
      assigned: mine.length,
      contacted,
      enrolled,
      conversion: mine.length ? (enrolled / mine.length) * 100 : 0,
      earned: myRewards.reduce((s: number, r: any) => s + (r.amount || 0), 0),
      paid: myRewards.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + (r.amount || 0), 0),
    };
  });
};
