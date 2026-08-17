-- Composite index covering the team_member_id equality filter + date sort
-- used by TeamAppointmentsPage fetchAppts query:
--   .eq("team_member_id", user.id)
--   .or(`scheduled_at.gte.<cutoff>,outcome.is.null`)
--   .order("scheduled_at")
CREATE INDEX IF NOT EXISTS idx_appointments_member_scheduled
  ON public.appointments (team_member_id, scheduled_at DESC);

-- Partial index for the outcome IS NULL safety-net branch —
-- prevents full per-member scans as appointment history grows.
CREATE INDEX IF NOT EXISTS idx_appointments_member_no_outcome
  ON public.appointments (team_member_id)
  WHERE outcome IS NULL;
