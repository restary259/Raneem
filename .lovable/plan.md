

# Complete Dashboard Overhaul: Simplify, Consolidate, Clean Up

## The Problem

The current admin dashboard has **18 separate tabs** spread across 5 groups. Many overlap in purpose, creating confusion and unnecessary navigation. The funnel visualization still references legacy statuses that were removed from the actual workflow. Financial data is scattered across multiple views.

## New Simplified Structure

### Admin Dashboard: 18 tabs reduced to 10

Current 18 tabs grouped into a cleaner structure:

```text
BEFORE (18 tabs):                    AFTER (10 tabs):
-------------------------------      --------------------------
Dashboard:                           Pipeline:
  - Overview                           - Overview (merged with Analytics)
  - Analytics                          - Leads
Students:                              - Cases (merged with Ready)
  - Leads                            People:
  - Cases                              - Students (merged with Checklist)
  - Ready                              - Partners (merged Influencers + Referrals)
  - Students                         Finance:
  - Checklist                          - Services (renamed Master Services)
Team:                                  - Money (merged with Payouts)
  - Influencers                      System:
  - Referrals                          - Contacts
Finance:                               - Settings (merged Eligibility + Notifications)
  - Master Services                    - Security + Audit (merged)
  - Money
  - Payouts
Tools:
  - Majors
  - Contacts
  - Notifications
  - Eligibility
  - Security
  - Audit
```

### What Gets Merged

1. **Overview + Analytics** -- KPI cards, funnel, and charts all in one view
2. **Cases + Ready to Apply** -- "Ready" is just a filtered view of cases; add a filter toggle instead of a separate tab
3. **Students + Checklist** -- Checklist is per-student; embed it within student management
4. **Influencers + Referrals** -- Both are partner/team management; combine into one "Partners" tab
5. **Money + Payouts** -- Both are financial operations; payouts become a section within Money
6. **Eligibility + Notifications** -- Low-traffic config screens; combine into a "Settings" tab
7. **Security + Audit** -- Both are security/compliance; combine into one tab
8. **Majors** -- Stays as is (recently built, self-contained)

### Funnel Visualization Fix

Update `FunnelVisualization.tsx` to remove legacy statuses (`appointment`, `registration_submitted`, `settled`) and align with the actual 6-stage funnel: new, eligible, assigned, contacted, paid, ready_to_apply, visa_stage, completed.

### Financial Simplification

Currently, when attaching services to a case, the system:
1. Creates snapshots from master services (correct)
2. Adds snapshot totals to the case's `service_fee`, `lawyer_commission`, `influencer_commission` fields

The case card in CasesManagement also allows **manual editing** of all 6 financial fields. This creates confusion because the manual values can diverge from the snapshot totals.

**Fix:** Make the financial fields on the case **read-only summaries** calculated from attached snapshots. Remove manual financial input fields from the case edit form. The only way to change financials is to attach/remove services from the master services table.

### Team Dashboard

Already streamlined to 3 tabs -- no changes needed. The Team Dashboard is clean.

## Technical Details

### Files to Modify

**1. `src/components/admin/AdminLayout.tsx`**
- Reduce sidebar groups from 5 to 4
- Reduce total tabs from 18 to 10
- Update tab IDs and icons

**2. `src/pages/AdminDashboardPage.tsx`**
- Remove imports for merged components
- Update `renderContent()` switch statement
- Remove redundant state variables

**3. `src/components/admin/AdminOverview.tsx`**
- Merge KPIAnalytics content into Overview (charts, conversion metrics)
- Single unified dashboard view

**4. `src/components/admin/FunnelVisualization.tsx`**
- Remove legacy stages: `appointment`, `registration_submitted`, `settled`
- Use clean 8-stage funnel: new, eligible, assigned, contacted, paid, ready_to_apply, visa_stage, completed

**5. `src/components/admin/CasesManagement.tsx`**
- Add a "Ready to Apply" filter toggle (replaces the separate ReadyToApplyTable tab)
- Make financial fields read-only (calculated from snapshots)
- Remove manual number inputs for service_fee, commissions, etc.

**6. `src/components/admin/StudentManagement.tsx`**
- Embed checklist progress per student (inline, not separate tab)

**7. New: `src/components/admin/PartnersManagement.tsx`**
- Combines InfluencerManagement + ReferralManagement into one tabbed view

**8. `src/components/admin/MoneyDashboard.tsx`**
- Add PayoutsManagement as a section/sub-tab within Money

**9. New: `src/components/admin/SettingsPanel.tsx`**
- Combines EligibilityConfig + CustomNotifications

**10. New: `src/components/admin/SecurityAuditPanel.tsx`**
- Combines SecurityPanel + AuditLog into one view with sub-tabs

**11. Localization files**
- Update `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json` with new tab labels

### No Database Changes Required

All changes are UI-only. The database schema, RLS policies, and edge functions remain unchanged. This is purely a frontend consolidation.

### What Stays Unchanged

- Team Dashboard (already clean with 3 tabs)
- Student Dashboard
- Influencer Dashboard
- All Supabase tables, RLS policies, and triggers
- Real-time subscriptions
- Financial engine (auto_split_payment trigger)
- SLA logic
- Export functionality (CSV, XLSX, PDF)

