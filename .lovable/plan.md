
## Phase 6: In-App Notification Center ✅

Completed: notifications table, NotificationBell component, realtime subscriptions, case status triggers, all 4 dashboard integrations.

## Phase 7: Advanced Admin Reports & Email Notifications ✅

### 7A. Admin Analytics Upgrade
- Date-range filter (start/end date pickers) on Analytics tab
- All KPI cards, charts, and tables now filter by selected date range
- CSV export buttons for Revenue, Leads, and Cases reports

### 7B. Transactional Email Notifications
- `send-event-email` edge function: orchestrates branded emails + in-app notifications for:
  - **Welcome** — triggered on new user signup
  - **Status Change** — triggered when case status updates
  - **Referral Accepted** — triggered when referral status changes to 'enrolled'
- New email templates added to `send-branded-email`: welcome, status_change, referral_accepted, weekly_digest
- DB trigger `trg_referral_accepted_notify` auto-creates in-app notification when referral is enrolled

### 7C. Weekly Admin Digest
- `admin-weekly-digest` edge function: gathers weekly KPIs and sends branded email + in-app notification to all admins
- Scheduled via pg_cron every Monday at 8:00 AM

### Technical File Summary
| File | Action |
|------|--------|
| `src/components/admin/KPIAnalytics.tsx` | Added date-range filters + CSV export |
| `supabase/functions/send-event-email/index.ts` | New: transactional email orchestrator |
| `supabase/functions/admin-weekly-digest/index.ts` | New: weekly digest cron function |
| `supabase/functions/send-branded-email/index.ts` | Added welcome, status_change, referral_accepted, weekly_digest templates |
| DB Migration | Added referral_accepted trigger + pg_net extension |
| pg_cron | Scheduled weekly digest every Monday 8 AM |

### Note on Email Delivery
The `send-branded-email` function requires a `RESEND_API_KEY` secret. If not configured, emails will fail silently but in-app notifications will still work. To enable email delivery, add the RESEND_API_KEY secret.
