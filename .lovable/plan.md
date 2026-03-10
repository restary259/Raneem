

## What I Found — and the Blocker Stopping the Full Test

### Browser Test Blocker: Admin 2FA Gate
The browser session has the **admin account (ranimdwahde3@gmail.com) still logged in**. The `AdminSecurityGate` component enforces TOTP authentication on every page load — it checks `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` and if the current level is `aal1` (not `aal2`), it forces the 2FA screen before showing ANY content.

This means **I cannot navigate to `/student-auth` to log in as the team or partner accounts** while the admin session is persisted in localStorage. There is no "Sign Out" button on the 2FA screen — only the authenticator code input. The full browser-based test (Parts 1–6) **requires the user to first clear their admin session** by:
1. Opening the live preview (`https://id-preview--6ca0fcbe-667c-43cb-9cbf-11c55b0c4933.lovable.app`) in a regular browser tab
2. Entering the TOTP code to reach the admin dashboard
3. Clicking Sign Out (or simply clearing localStorage)
4. Then the test can proceed

---

### What I Could Verify via Code + DB Schema

**Translation Fix Status — CONFIRMED CORRECT:**

The JSON files are now properly structured:
- EN file: 2,036 lines — single `admin` block starting at line 245, containing all merged keys
- AR file: 2,067 lines — single `admin` block starting at line 245, same complete structure
- Both files contain: `admin.commandCenter`, `admin.pipeline`, `admin.team`, `admin.programs`, `admin.submissions`, `admin.analytics`, `admin.activity`, `admin.settings`, `admin.spreadsheet`, `admin.financials`, `admin.partnerPayouts`, `admin.payouts`, `admin.tabs`, `admin.leads`, `admin.ready`, `admin.referralsMgmt`
- Partner section: `partner.status.*` keys exist for all 8 DB status values
- No duplicate root keys found

**Schema Check — `rewards.user_id` has no FK to `profiles`:**

Confirmed in the schema info — `rewards` table has no foreign keys declared. The two-query fix in `PartnerPayoutsPanel.tsx` (lines 263–289) correctly works around this.

**Logic Review — `PartnerPayoutsPanel.tsx`:**
- Query 1: fetches rewards filtered by `admin_notes LIKE 'Partner commission from case%'`
- Query 2: fetches profiles by `user_id IN [...]`  
- Merge: manual JS Object.fromEntries
- This is correct and will NOT throw the "no relationship" error

**Logic Review — `PartnerOverviewPage.tsx`:**
- Reads actual `rewards WHERE status='paid' AND admin_notes LIKE 'Partner commission from case%'` for paid totals ✓
- Visibility mode correctly uses `partner_commission_overrides.show_all_cases` ✓
- Status labels use `t('partner.status.${c.status}', { defaultValue: cfg.label })` ✓

**Role Name Fix — `PayoutsManagement.tsx`:**
- Need to verify the filter fix was applied. Let me check the file quickly.

---

### Plan to Complete the Live Test

The user needs to do ONE thing first: **sign out of the admin account in the preview**. Then I can immediately execute all 6 parts of the test.

**What I will test once the session is cleared:**

| Part | Action | Expected Result |
|------|---------|----------------|
| Setup | DB query: 20 most recent cases | Pick Case A (apply/contact) and Case B (referral/manual) |
| 1.1 | Login as team@gmail.com | Team dashboard loads with correct Arabic/English translations |
| 1.2–1.3 | Find both cases | Cases appear in team case list |
| 2.x | Progress Case A through all stages | Each status change reflected in DB immediately |
| 3.x | Progress Case B same way | Same pipeline flow works for different source |
| 4.x | Login as admin, confirm enrollment | `commission_split_done=true`, rewards rows created correctly |
| 4.4 math | team + partners + admin = ₪4000 | Verify with DB query |
| 5.x | Login as partner@gmail.com | Cases visible per `show_all_cases` mode |
| 5.7 | Confirm payout via password gate | reward.status = 'paid', paid_at set |
| 6.x | 3 visibility modes | Each mode shows correct subset of cases |

---

### Changes needed before testing (based on code review)

**One issue found in `PartnerOverviewPage.tsx` line 463 (AR locale):**
```
"tabAgentPayouts": "مدفوعات الوكلاء",
```
The word "الوكلاء" (agents) conflicts with the memory rule that says the Partner role must be called "وكيل" in Arabic. This should be "مدفوعات الشركاء للفريق" or just "مدفوعات الفريق" since the "Agent Payouts" tab refers to team member payouts, not partner payouts.

**Files to fix before test:**
1. `public/locales/ar/dashboard.json` — line 463: `"tabAgentPayouts": "مدفوعات الفريق"` (team payouts, not agent)
2. Check `PayoutsManagement.tsx` for the `influencer` → `social_media_partner` filter fix

**The test itself cannot proceed until the admin 2FA is cleared from the browser session.**

