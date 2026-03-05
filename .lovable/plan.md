
## Scope

This is a large multi-part task. I'll break it into focused groups:

1. **Apply page → cases not created** (bug fix)
2. **Live activity not working** (missing realtime subscription)
3. **Apply page shows in influencer dashboard** (already handled via `cases.partner_id` — need to verify)
4. **Team member names/emails in admin** (already done — AdminTeamPage shows them)
5. **Bottom navigation in each dashboard** (new mobile bottom nav per role)
6. **Login page cleanup** (remove extra UI text)
7. **Full translation audit** (all dashboards, modals, buttons)

---

## Root Cause: Apply Page Not Creating Cases

The `ApplyPage` calls `supabase.rpc('insert_lead_from_apply', ...)` which inserts into `leads` table. But the Team Dashboard (`TeamCasesPage`) reads from the `cases` table — a **different table**. There's a data model mismatch.

The `cases` table is the current unified pipeline (per architecture memory), but the apply page still writes to `leads`. Fix: **also call `create-case-from-apply` edge function** (or do a direct insert into `cases`) after the lead is created.

Looking at `create-case-from-apply/index.ts` — it inserts into `cases` table directly. The `ApplyPage` should call this edge function (no auth needed, it's public).

However, the edge function validates `partner_id` against `social_media_partner` role but the influencer role is `social_media_partner` in the new arch. The ref validation in `ApplyPage` checks `influencer` role in `user_roles` via `validate_influencer_ref` RPC — but the new role is `social_media_partner`. This may also be why influencer attribution breaks.

**Fix plan for ApplyPage:**
- After inserting lead, also POST to `create-case-from-apply` (no auth header needed — it's a public endpoint) with `{ full_name, phone_number, source: 'apply_page', partner_id: sourceId }`
- Fix `validate_influencer_ref` RPC to check `social_media_partner` OR `influencer` role

**Contact page**: `src/landing/Contact.tsx` — need to check if it also creates a case.

---

## Live Activity Not Working

`AdminActivityPage` reads from `activity_log` table. Need to check if it has realtime enabled and if the subscription is set up.

---

## Files to Change

### 1. `src/pages/ApplyPage.tsx`
- After successful `insert_lead_from_apply`, also call `create-case-from-apply` edge function (public, no auth)
- Pass `partner_id` when `sourceType === 'influencer'`

### 2. `supabase/functions/create-case-from-apply/index.ts`
- Validate `partner_id` against both `social_media_partner` AND `influencer` roles (the role name changed)

### 3. `src/pages/StudentAuthPage.tsx`
- Remove the "Logo / Brand" block and the footer note — keep only: back-to-website link, the card (email+password+login button), and password-change dialog

### 4. Mobile Bottom Navigation — NEW component per dashboard
Create `src/components/layout/MobileBottomNav.tsx` — takes `role: AppRole` and shows fixed bottom nav (4-5 items max) using `NAV_CONFIG` from `DashboardLayout`. Add it inside `DashboardLayout.tsx` below the `<main>` tag (only visible on mobile).

### 5. `src/pages/team/TeamTodayPage.tsx`
- Full i18n: all hardcoded strings → `t('team.today.*')` keys
- Keys already exist in `en/dashboard.json` for most — just wire them up

### 6. Translation files audit
The following files need new/fixed keys:

**`public/locales/en/dashboard.json`** — add missing keys:
```json
"team": {
  "today": {
    "overdue": "{{n}} appointment(s) need outcomes recorded",
    "kpiToday": "Today",
    "kpiCases": "Total Cases",
    "kpiPending": "Pending",
    "kpiOverdue": "Overdue",
    "appointments": "appointments",
    "assigned": "assigned",
    "needAction": "need action",
    "needOutcome": "need outcome",
    "scheduleTitle": "Today's Schedule",
    "noAppts": "No appointments today",
    "upcoming": "Upcoming",
    "recordOutcome": "Record Outcome",
    "viewCase": "View Case",
    "newCase": "New Case",
    "loading": "Loading..."
  },
  "cases": {
    "searchPlaceholder": "Search cases...",
    "create": "Create New Case",
    "nameLabel": "Full Name",
    "phoneLabel": "Phone Number",
    "creating": "Creating...",
    "status": {
      "new": "New",
      ...
    }
  }
}
```

**`public/locales/ar/dashboard.json`** — mirror all new keys in Arabic.

### 7. Pages that need i18n wiring (all have hardcoded English):
- `TeamTodayPage.tsx` — fully hardcoded
- `TeamCasesPage.tsx` — partially hardcoded (tabs, buttons, search)
- `CaseDetailPage.tsx` — need to check
- `TeamAppointmentsPage.tsx` — need to check
- `AdminActivityPage.tsx` — need to check
- `AdminCommandCenter.tsx` — partially done
- `AdminPipelinePage.tsx` — partially done

### 8. Contact page case creation
Check `Contact.tsx` — if it uses `upsert_lead_from_contact` RPC, wire it to also create a case via `create-case-from-apply`.

---

## Execution Order

```
Step 1: Fix ApplyPage → call create-case-from-apply after lead insert
Step 2: Fix create-case-from-apply → accept social_media_partner role  
Step 3: Strip login page extra UI  
Step 4: Build MobileBottomNav component + wire into DashboardLayout
Step 5: Wire i18n into TeamTodayPage + TeamCasesPage
Step 6: Add missing translation keys to en/dashboard.json + ar/dashboard.json
Step 7: Wire i18n into AdminActivityPage, AdminCommandCenter
Step 8: Check + fix Contact page to create cases
```

---

## Mobile Bottom Nav Design

```text
[Team]     [Cases]     [Appts]     [Students]    [Analytics]
  🏠         📋          📅           👥             📊
```

Fixed to bottom, `z-50`, `h-16`, `border-t`. Active item highlighted with primary color. Icons + short label. Max 5 items (overflow hidden). Rendered only on `md:hidden`.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/pages/ApplyPage.tsx` | Call `create-case-from-apply` after lead insert |
| `supabase/functions/create-case-from-apply/index.ts` | Accept `social_media_partner` role |
| `src/pages/StudentAuthPage.tsx` | Remove brand/logo block and footer text |
| `src/components/layout/MobileBottomNav.tsx` | NEW: role-aware mobile bottom nav |
| `src/components/layout/DashboardLayout.tsx` | Add `<MobileBottomNav>` + bottom padding |
| `src/pages/team/TeamTodayPage.tsx` | Full i18n wiring |
| `src/pages/team/TeamCasesPage.tsx` | i18n wiring for hardcoded strings |
| `public/locales/en/dashboard.json` | Add missing team/admin keys |
| `public/locales/ar/dashboard.json` | Mirror in Arabic |
