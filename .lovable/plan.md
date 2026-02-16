# Comprehensive Admin Dashboard Audit Report & Implementation Plan

## AUDIT FINDINGS SUMMARY

### A. CURRENT STATE - WHAT'S WORKING


| Area                        | Status | Notes                                                   |
| --------------------------- | ------ | ------------------------------------------------------- |
| Sidebar structure           | OK     | 5 groups, no duplicates after last fix                  |
| Chat widget hidden on admin | OK     | `path.startsWith('/admin')` check works                 |
| Assign team member button   | OK     | Shows for all leads except `not_eligible`               |
| Lead source badges          | OK     | Shows influencer name, referral, organic                |
| Student Cases tab           | OK     | Filters by ready statuses, has sub-tabs                 |
| Money Dashboard             | OK     | Auto-calculates from case data, uses shekel             |
| Funnel visualization        | OK     | 12 stages matching lifecycle                            |
| Realtime subscriptions      | OK     | 6 tables subscribed                                     |
| Database triggers           | OK     | All 7 triggers attached correctly                       |
| Commission on create        | OK     | Edge function accepts `commission_amount`               |
| RLS policies                | OK     | All tables properly secured                             |
| Payment split trigger       | OK     | `auto_split_payment` fires on `case_status = 'paid'`    |
| Notification triggers       | OK     | Case status, referral accepted, payout status all wired |


### B. CRITICAL ISSUES FOUND

#### Issue 1: Assign Team Member Dropdown Shows Only 1 Person (darbsocial27)

**Root Cause**: The `lawyers` array in `AdminDashboardPage.tsx` line 113 fetches profiles with `role = 'lawyer'`. Currently only ONE user has that role (`979e3afc` = darbsocial27). The dropdown is NOT broken -- it correctly shows all users with `lawyer` role. The user sees only 1 because only 1 exists.

**Fix**: No code fix needed. When more team members are created via the "Add Member" dialog with role = "Team Member" (lawyer), they will appear. However, we should ALSO show influencers in the assign dropdown since the user may want to assign leads to agents too.

#### Issue 2: Missing Visa-Critical Fields on Student Profile

**Current `profiles` table columns**: id, email, full_name, phone_number, country, city, intake_month, university_name, visa_status, notes, student_status, influencer_id, commission_amount, bank fields, consent fields.

**Missing fields** requested for visa applications:

- `eye_color` (text)
- `gender` (text: male/female)
- `has_changed_legal_name` (boolean, default false)
- `previous_legal_name` (text, nullable)
- `has_criminal_record` (boolean, default false)
- `criminal_record_details` (text, nullable)
- `has_dual_citizenship` (boolean, default false)
- `second_passport_country` (text, nullable)

#### Issue 3: CasesManagement.tsx Still Exists But Not Routed

`CasesManagement.tsx` (423 lines) is still in the codebase but no longer routed from the sidebar. It should be fully removed to avoid confusion. Its functionality is covered by `StudentCasesManagement.tsx`.

#### Issue 4: No Trigger for "Case Created" Notification to Influencer

When a case is created from a lead, no notification is sent to the influencer. Only status CHANGES trigger `notify_case_status_change`. Case creation is an INSERT, not an UPDATE.

#### Issue 5: MoneyDashboard Still Has CSV Export

Line 157-167 in `MoneyDashboard.tsx` has a `exportCSV` function. It's not rendered as a button anymore (only PDF button visible), but the dead code remains.

#### Issue 6: LeadsManagement Still Has CSV Export

Line 199-213 has `exportCSV` function that IS rendered (used in the CSV button). Per previous plan, only PDF should remain.

#### Issue 7: `commission_amount` is 0 for Both Team Member and Agent

Both `darbsocial27@gmail.com` (lawyer) and `tsukuyomidomain00@gmail.com` (influencer) have `commission_amount = 0`. This means payment splits will calculate 0 for commissions.

---

## IMPLEMENTATION PLAN

### Stage 1: Database Migration - Add Visa-Critical Fields to Profiles

Add 8 new columns to `profiles` table:

- `gender` text nullable
- `eye_color` text nullable
- `has_changed_legal_name` boolean default false
- `previous_legal_name` text nullable
- `has_criminal_record` boolean default false
- `criminal_record_details` text nullable
- `has_dual_citizenship` boolean default false
- `second_passport_country` text nullable

These fields are sensitive legal data -- existing RLS policies already restrict access properly:

- Students can view/edit own profile
- Admins have full access
- Influencers can only view assigned students (read-only by RLS)
- Team members (lawyers) have no direct profile access -- they see case data only

### Stage 2: Database Trigger - Notify Influencer on Case Creation

Create a new trigger on `student_cases` for INSERT events that sends a notification to the influencer when a case is created from their lead:

```text
TRIGGER: trg_notify_influencer_case_created
TABLE: student_cases
EVENT: AFTER INSERT
LOGIC:
  1. Look up the lead via NEW.lead_id
  2. If lead.source_type = 'influencer' AND lead.source_id IS NOT NULL
  3. Insert notification for the influencer
```

### Stage 3: Update Student Profile UI (StudentProfile.tsx)

Add the new visa-critical fields to the student profile form:

- Gender dropdown (Male/Female)
- Eye Color dropdown (Brown, Blue, Green, Hazel, Gray, Other)
- Has Changed Legal Name toggle + conditional Previous Name field
- Criminal Record toggle + conditional Details field
- Dual Citizenship toggle + conditional Second Passport Country field

Fields are:

- Editable by student (own profile)
- Viewable by admin (full access)
- Viewable by influencer (read-only via RLS)
- NOT editable by influencer (enforced by RLS)

### Stage 4: Update Admin Student Profiles View

Update `StudentProfilesManagement.tsx` detail modal to show the new legal fields in a dedicated "Legal / Visa" section. Fields are read-only in admin view but admin CAN edit them if needed.

### Stage 5: Update Student Cases Detail View

Add gender, eye color, and legal fields to the Profile tab in `StudentCasesManagement.tsx` detail dialog, and include them in the bulk PDF export.

### Stage 6: Fix Assign Dropdown to Include Both Lawyers AND Influencers

Update `LeadsManagement.tsx` assign modal to show BOTH lawyers and influencers in the dropdown (with role badges), since both types of team members can be assigned to leads.

### Stage 7: Remove Dead Code

- Delete `src/components/admin/CasesManagement.tsx` (no longer routed)
- Remove `exportCSV` function from `MoneyDashboard.tsx`
- Remove CSV export button and function from `LeadsManagement.tsx`
- Clean up any unused imports

### Stage 8: Update Translations

Add translation keys for all new fields in both `en/dashboard.json` and `ar/dashboard.json`:

- profile.gender, profile.eyeColor
- profile.hasChangedLegalName, profile.previousLegalName
- profile.hasCriminalRecord, profile.criminalRecordDetails
- profile.hasDualCitizenship, profile.secondPassportCountry

### Stage 9: Update Profile TypeScript Type

Add new fields to `src/types/profile.ts`:

```text
gender?: string;
eye_color?: string;
has_changed_legal_name?: boolean;
previous_legal_name?: string;
has_criminal_record?: boolean;
criminal_record_details?: string;
has_dual_citizenship?: boolean;
second_passport_country?: string;
```

---

## PERMISSION ALIGNMENT MATRIX


| Action                             | Student   | Influencer      | Team Member     | Admin        |
| ---------------------------------- | --------- | --------------- | --------------- | ------------ |
| View own profile                   | Yes       | N/A             | N/A             | Yes (all)    |
| Edit own basic info                | Yes       | N/A             | N/A             | Yes (all)    |
| Edit legal fields after submission | No        | No              | No              | Yes          |
| View assigned students             | N/A       | Yes (read-only) | Yes (via cases) | Yes          |
| Edit student legal data            | N/A       | No              | No              | Yes          |
| View case stage                    | Yes (own) | Yes (assigned)  | Yes (assigned)  | Yes          |
| Update case stage                  | No        | No              | Yes (assigned)  | Yes          |
| Mark payment as confirmed          | No        | No              | No              | Yes          |
| View commission status             | N/A       | Yes (own)       | Yes (own)       | Yes          |
| Upload documents                   | Yes       | No              | No              | yes          |
| Download student documents         | No        | No              | No              | Yes          |
| Trigger commission calculation     | N/A       | N/A             | N/A             | Auto on PAID |
| Access analytics                   | No        | Limited         | Limited         | Full         |


All enforced by RLS at database level -- frontend only reflects what the backend allows.

---

## PAYMENT LOGIC AUDIT RESULT


| Check                              | Status  | Notes                                                                                                      |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| Single `case_status` field         | OK      | On `student_cases` table                                                                                   |
| Commission triggers on PAID        | OK      | `auto_split_payment` trigger fires on `case_status = 'paid'`                                               |
| Commission calculated once         | OK      | Trigger uses `ON CONFLICT DO NOTHING` for `commissions` insert                                             |
| Duplicate payment blocked          | OK      | Trigger checks `OLD.case_status IS DISTINCT FROM 'paid'`                                                   |
| Revenue counted once               | OK      | MoneyDashboard filters by `paid_at` existence                                                              |
| Referral discount applied          | OK      | Trigger checks `source_type = 'referral'` and creates reward                                               |
| Influencer commission from profile | OK      | Trigger reads `commission_amount` from profiles                                                            |
| Audit trail                        | Partial | Financial exports logged, but payment status changes are not logged to audit_log (only notifications fire) |


**Weakness found**: Payment status changes are not logged to `admin_audit_log`. Only notifications are created. Will add audit logging when admin marks a case as PAID in the StudentCasesManagement component.

---

## NOTIFICATION VALIDATION


| Event                            | Trigger Exists                       | Notification Created                                                        |
| -------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Case status changed              | Yes (`trg_case_status_notify`)       | Yes, to `student_profile_id`                                                |
| Case created (new)               | **No**                               | **Missing** -- will add                                                     |
| Referral accepted                | Yes (`trg_referral_accepted_notify`) | Yes, to `referrer_id`                                                       |
| Payout status changed            | Yes (`trg_payout_status_notify`)     | Yes, to `requestor_id`                                                      |
| Payment confirmed                | Yes (via status change trigger)      | Yes, fires when status changes to `paid`                                    |
| Admin notified on ready_to_apply | **No**                               | **Missing** -- admin notifications not implemented (admins check dashboard) |


---

## DATA FLOW VALIDATION

```text
Student submits /apply
  -> insert_lead_from_apply() RPC
  -> leads table (with score + status)
  -> Admin sees in Leads tab (realtime)

Admin marks eligible
  -> leads.status = 'eligible'
  -> student_cases INSERT
  -> Influencer notified (WILL ADD)

Admin assigns team member
  -> student_cases.assigned_lawyer_id SET
  -> case_status updates
  -> notify_case_status_change fires -> student notified

Team member progresses case
  -> case_status moves forward
  -> All dashboards update via realtime

Admin marks PAID
  -> auto_split_payment trigger fires
  -> commissions INSERT
  -> rewards INSERT (for influencer)
  -> referrals UPDATE (if referral)
  -> All dashboards reflect via realtime
```

No circular dependencies found. No broken references. All status updates fire correct backend events.

---

## FILES CHANGED


| File                                                 | Action                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Database migration                                   | ADD 8 columns to profiles + ADD case creation notification trigger   |
| `src/types/profile.ts`                               | ADD new field types                                                  |
| `src/components/dashboard/StudentProfile.tsx`        | ADD visa-critical fields to form                                     |
| `src/components/admin/StudentProfilesManagement.tsx` | ADD legal section to detail modal                                    |
| `src/components/admin/StudentCasesManagement.tsx`    | ADD legal fields to profile tab + PDF export + audit log on PAID     |
| `src/components/admin/LeadsManagement.tsx`           | FIX assign dropdown to show lawyers + influencers, REMOVE CSV export |
| `src/components/admin/MoneyDashboard.tsx`            | REMOVE dead CSV code                                                 |
| `src/components/admin/CasesManagement.tsx`           | DELETE file                                                          |
| `public/locales/en/dashboard.json`                   | ADD new translation keys                                             |
| `public/locales/ar/dashboard.json`                   | ADD new translation keys                                             |
