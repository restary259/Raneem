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

const throwIf = (error: any) => {
  if (error) throw error;
};

/* ---------------------------------- Students --------------------------------- */

export const fetchStudentsSheet = async ({ scope, userId }: SheetScope) => {
  const staff = await staffNameMap();

  let query = (supabase as any)
    .from('case_submissions')
    .select(`
      id, program_start_date, program_end_date, extra_data,
      program_price, accommodation_price, insurance_price,
      service_fee, total_paid, remaining_balance, enrollment_paid_at,
      case:cases!inner(id, full_name, phone_number, city, status, assigned_to, partner_id),
      program:programs(name_en),
      accommodation:accommodations(name_en),
      insurance:insurances(name)
    `)
    .is('deleted_at', null);

  if (scope === 'team' && userId) query = query.eq('case.assigned_to', userId);

  const { data, error } = await query;
  throwIf(error);

  return (data || []).map((s: any) => {
    const extra = s.extra_data ?? {};
    return {
      id: s.id,
      full_name: s.case?.full_name ?? '—',
      phone: s.case?.phone_number ?? null,
      city: s.case?.city ?? extra.city ?? null,
      status: s.case?.status ?? null,
      team_member: staff[s.case?.assigned_to]?.name ?? null,
      partner: staff[s.case?.partner_id]?.name ?? null,
      school_name: extra.school_name ?? null,
      program_name: s.program?.name_en ?? null,
      accommodation_name: s.accommodation?.name_en ?? null,
      insurance_name: s.insurance?.name ?? null,
      intake_month: extra.start_month ?? (s.program_start_date ? s.program_start_date.slice(0, 7) : null),
      course_start: s.program_start_date,
      course_end: s.program_end_date,
      program_price: s.program_price ?? 0,
      accommodation_price: s.accommodation_price ?? 0,
      insurance_price: s.insurance_price ?? 0,
      total: (s.program_price ?? 0) + (s.accommodation_price ?? 0) + (s.insurance_price ?? 0),
    };
  });
};

/* ---------------------------------- Payments --------------------------------- */

export const fetchPaymentsSheet = async ({ scope, userId }: SheetScope) => {
  const staff = await staffNameMap();

  let query = (supabase as any)
    .from('case_submissions')
    .select(`
      id, service_fee, program_price, accommodation_price, insurance_price,
      total_paid, remaining_balance, enrollment_paid_at, enrollment_paid_by,
      payment_confirmed_at, payment_confirmed_by,
      case:cases!inner(id, full_name, assigned_to, status)
    `)
    .is('deleted_at', null)
    .not('enrollment_paid_at', 'is', null);

  if (scope === 'team' && userId) query = query.eq('case.assigned_to', userId);

  const { data, error } = await query;
  throwIf(error);

  return (data || []).map((s: any) => ({
    id: s.id,
    paid_date: s.enrollment_paid_at,
    student: s.case?.full_name ?? '—',
    service_fee: s.service_fee ?? 0,
    program_price: s.program_price ?? 0,
    accommodation_price: s.accommodation_price ?? 0,
    insurance_price: s.insurance_price ?? 0,
    total_paid: s.total_paid ?? 0,
    remaining_balance: s.remaining_balance ?? 0,
    confirmed_by: staff[s.enrollment_paid_by ?? s.payment_confirmed_by]?.name ?? null,
    status: s.case?.status ?? null,
  }));
};

/* ---------------------------------- Payouts ---------------------------------- */

export const fetchPayoutsSheet = async () => {
  const staff = await staffNameMap();
  const { data, error } = await (supabase as any)
    .from('payout_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  throwIf(error);

  return (data || []).map((p: any) => ({
    id: p.id,
    requested_at: p.requested_at,
    paid_at: p.paid_at,
    person: staff[p.requestor_id]?.name ?? '—',
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

  return (data || []).map((r: any) => {
    const notes: string = r.admin_notes ?? '';
    const kind = notes.startsWith('Partner commission')
      ? 'partner'
      : notes.startsWith('Team commission')
        ? 'team'
        : 'other';
    const unlock = new Date(new Date(r.created_at).getTime() + LOCK_DAYS * 86400000);
    return {
      id: r.id,
      created_at: r.created_at,
      person: staff[r.user_id]?.name ?? '—',
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
    (supabase as any).from('programs').select('*'),
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
      school: null,
      city: null,
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

  let rewardsQuery = (supabase as any).from('rewards').select('user_id, amount, status, admin_notes');
  if (scope === 'team' && userId) rewardsQuery = rewardsQuery.eq('user_id', userId);

  const [casesRes, rewardsRes] = await Promise.all([casesQuery, rewardsQuery]);
  throwIf(casesRes.error || rewardsRes.error);

  const cases = casesRes.data || [];
  const rewards = (rewardsRes.data || []).filter((r: any) =>
    (r.admin_notes ?? '').startsWith('Team commission'),
  );

  const ids = Array.from(
    new Set([
      ...cases.map((c: any) => c.assigned_to).filter(Boolean),
      ...rewards.map((r: any) => r.user_id),
    ]),
  ) as string[];

  return ids.map(id => {
    const mine = cases.filter((c: any) => c.assigned_to === id);
    const enrolled = mine.filter((c: any) => c.status === ENROLLED).length;
    const contacted = mine.filter((c: any) => c.status !== 'new').length;
    const myRewards = rewards.filter((r: any) => r.user_id === id);
    return {
      id,
      person: staff[id]?.name ?? '—',
      assigned: mine.length,
      contacted,
      enrolled,
      conversion: mine.length ? (enrolled / mine.length) * 100 : 0,
      earned: myRewards.reduce((s: number, r: any) => s + (r.amount || 0), 0),
      paid: myRewards.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + (r.amount || 0), 0),
    };
  });
};
