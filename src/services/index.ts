/**
 * Data-access layer.
 *
 * Pages and components should import from `@/services` instead of calling
 * `supabase.from(...)` directly. Every function here returns plain data and
 * throws on error, so callers only handle one failure path.
 *
 * RLS remains the source of truth — these wrappers never widen access.
 */
export * from './CaseService';
export * from './StudentService';

export * from './PartnerService';
export * from './PaymentService';
export * from './NotificationService';
export * from './DashboardService';
