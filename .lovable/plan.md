# You will **update, optimize, and secure the platform in stages**. Do not skip steps. Do not implement new features from future stages before the previous stage is completed and verified. Maintain **all existing functionality** unless explicitly stated. Always backup any module before editing. Keep all connections between dashboards, tabs, and flows intact.

**Output Format:**  
For each stage, provide:

1. **Identified issues / weak points**
2. **Proposed solution / fix**
3. **Acceptance criteria**
4. **Notes for QA / testing**
5. **Any database or backend changes needed** Darb Study -- Funnel and Dashboard Audit: Prioritized Implementation Plan

This plan addresses the audit findings in priority order, focusing on what can be implemented in code. Items requiring business decisions are flagged for leadership.

---

## Sprint 0: Critical Fixes (Week 1)

### 1. Anonymize PII in Influencer Dashboard

**Problem:** Influencer "Students" tab shows full names, cities, German levels, and eligibility reasons for all leads -- privacy and legal risk.

**Fix:**

- In `src/pages/InfluencerDashboardPage.tsx`, replace `lead.full_name` with initials + city (e.g., "م.ع — حيفا") in the Students tab
- Hide `eligibility_reason` text (which may contain passport details) -- show only "Eligible" / "Not Eligible" badge
- Show full name only for students who have been assigned a profile (i.e., have a `student_profile_id` linking them back, indicating consent)
- Keep KPI counts and pie chart as-is (aggregated, no PII)

### 2. Clean Mobile Apply Page for Influencer Links

**Problem:** When arriving via `?ref=...`, students see: InAppBrowserBanner, full Header nav, BottomNav, ChatWidget, PWAInstaller, CookieBanner -- causing confusion and drop-off.

**Fix:**

- In `src/pages/ApplyPage.tsx`, detect `?ref=` param and set a `isInfluencerApply` flag
- When `isInfluencerApply` is true, hide: Header, BottomNav, ChatWidget, PWAInstaller, InAppBrowserBanner
- Keep only: brand logo (ApplyTopBar already exists), the form, and a minimal privacy/contact footer
- This can be done by wrapping the ApplyPage in its own layout that conditionally excludes App-level chrome, OR by passing a context/state that hides those components

**Implementation approach:**

- Add a `hideChrome` route state or query detection in `App.tsx`
- When `/apply?ref=...` is active, conditionally hide BottomNav, ChatWidget, PWAInstaller
- The ApplyTopBar already provides minimal branding -- keep it

### 3. Phone Validation (E.164)

**Problem:** Phone field accepts any text, leading to invalid data.

**Fix:**

- In `src/pages/ApplyPage.tsx`, add regex validation for Israeli phone format (`/^05\d{8}$/` or international `+972...`)
- Show inline error message if invalid
- Block form submission until valid

---

## Sprint 1: Form and Flow Improvements (Weeks 2-3)

### 4. Remove German Level from Apply Form

**Problem:** Asking German level on a free consult form is unnecessary friction.

**Fix:**

- Remove Step 3 (German level) from the apply form
- Move the companion toggle into Step 2 (after major selection)
- Reduce form to 2 steps instead of 3
- Update progress indicator accordingly

### 5. Add "Applying With" Field (Value Positioning)

**Problem:** Companion toggle wording is unclear; "discount" language devalues brand.

**Fix:**

- Replace the checkbox "registering with friend/family" with a radio group: "Alone" / "With Family" / "With Friend"
- When family/friend selected, show companion fields with value-positioned copy: "Group Application Credit -- shared guidance and smoother logistics"
- Never use the word "discount" in UI copy

### 6. Post-Submit Confirmation Enhancement

**Problem:** After submitting, student gets a generic success screen with no clear next step.

**Fix:**

- Show expected contact time: "We will contact you within 24 hours via WhatsApp"
- Add a WhatsApp link to Darb's official number for immediate questions
- Show the student's ref code if generated

### 7. Preferred Major Typeahead

**Problem:** Major selection is a dropdown with many nested groups -- slow on mobile.

**Fix:**

- Replace the Select dropdown with a searchable combobox (using the existing `cmdk` dependency)
- Allow typing to filter majors instantly
- Keep "Other" as a free-text fallback option

---

## Sprint 2: Admin and RBAC Improvements (Weeks 4-6)

### 8. Assign Team Member Modal -- Show Registered Members

**Problem:** User reported that clicking "Assign Team Member" doesn't show registered team members.

**Fix:**

- Verify that `lawyers` prop in LeadsManagement is populated from `user_roles` + `profiles` where role = 'lawyer'
- In `AdminDashboardPage.tsx`, ensure the query fetches team members correctly
- Add loading state and "No team members found" fallback in the assign modal

### 9. Simplify Case Statuses

**Problem:** 10 case statuses overwhelm team members.

**Fix:**

- Reduce active statuses to: `assigned` -> `contacted` -> `paid` -> `ready_to_apply` -> `visa_stage` -> `completed`
- Remove or merge: `appointment` (into contacted), `closed` (into a separate archive), `registration_submitted` (into ready_to_apply), `settled` (into completed)
- Update `CasesManagement.tsx` status keys and valid transitions
- Keep backward compatibility for existing data

### 10. Audit Log for PII Access

**Problem:** No tracking of who accesses sensitive student data.

**Fix:**

- The `admin_audit_log` table already exists
- Add logging calls when: viewing student passport docs, exporting leads, accessing financial data
- Already partially done for assign and override actions

---

## Sprint 3: Automation and Payments (Weeks 7-12)

### 11. Lead Contact SLA (24h Auto-Escalation)

**Problem:** Leads can sit uncontacted indefinitely.

**Fix:**

- Add a `last_contacted` timestamp field (already exists in leads table)
- Create a cron edge function that runs daily:
  - Find leads with status = 'assigned' and no contact in 24h
  - Send admin notification
  - After 7 days, mark as 'stale' and trigger re-assignment alert

### 12. Payout IBAN Validation

**Problem:** No validation of bank details before payout processing.

**Fix:**

- Add `iban` and `bank_name` fields to profiles table
- In influencer EarningsPanel, require IBAN entry before allowing payout request
- Validate IBAN format (basic regex for Israeli/German IBANs)
- Require double-entry confirmation

---

## Decisions Required from Leadership (Cannot Implement Without Input)


| Decision                | Impact                              | Options                                               |
| ----------------------- | ----------------------------------- | ----------------------------------------------------- |
| Payout currency policy  | Affects payment flow                | NIS only vs. multi-currency (NIS + EUR)               |
| Payment gateway         | Affects entire payment architecture | Stripe / local Israeli gateway / Wise / bank transfer |
| Family Credit wording   | Marketing copy                      | "Group Application Credit" vs. alternative            |
| PII retention period    | Legal compliance                    | How long to keep passport scans and bank details      |
| Ambassador compensation | New program                         | Paid vs. unpaid mentors, event fee structure          |
| 2FA enforcement         | Security                            | Require for admin/team or recommend only              |
| WhatsApp Business API   | Automation                          | Purchase API access for automated confirmations       |


---

## Technical Notes

**Files to modify in Sprint 0-1:**

- `src/pages/ApplyPage.tsx` -- form simplification, validation, clean layout
- `src/pages/InfluencerDashboardPage.tsx` -- PII anonymization
- `src/App.tsx` -- conditional chrome hiding for apply flow
- `src/components/common/BottomNav.tsx` -- hide on apply route

**Files to modify in Sprint 2:**

- `src/components/admin/CasesManagement.tsx` -- status simplification
- `src/components/admin/LeadsManagement.tsx` -- assign modal verification
- `src/pages/AdminDashboardPage.tsx` -- team member query fix

**New files in Sprint 3:**

- `supabase/functions/lead-sla-check/index.ts` -- cron function for SLA
- Database migration for IBAN fields on profiles

**No breaking changes:** All fixes maintain backward compatibility with existing data. Status simplification maps old statuses to new ones without data loss.    🔧 STAGE 1 — FLOW STRUCTURE & STATUS SIMPLIFICATION

**Objective:** Clean logic backbone. Improve automation. Increase clarity. Ensure scalability.  
**Important:**

- Do NOT redesign UI.
- Do NOT add large new features.
- Only optimize logic, structure, automation, and flow reliability.

---

## 1️⃣ CASE STATUS SYSTEM RESTRUCTURE (CRITICAL)

### 🎯 Goal

Eliminate status confusion and unify all dashboards under one clean funnel logic.

### Replace all current status variations with ONLY these core statuses:

1. **Assigned**  
→ Admin assigned case to team member.
2. **Contacted**  
→ First successful contact attempt logged.
3. **Appointment Set** (Optional but recommended)  
→ Meeting scheduled with student.
4. **Converted**  
→ Student has paid:
  - Language school
  - Darb service fee  
  AND services are attached.
5. **Ready for Visa**  
→ Profile fully completed + documents verified accurate.
6. **Visa Applied**  
→ Application officially submitted by admin.

---

### System Requirements

- These statuses must be used:
  - In Admin dashboard
  - In Team dashboard
  - In Influencer dashboard
  - In Reports
  - In Student timeline
- Remove any redundant or overlapping statuses.
- Status transitions must be trackable with timestamps.
- Maintain history log for audit protection.

---

## 2️⃣ AUTOMATION LOGIC FOR “CONVERTED”

### 🚨 IMPORTANT: Converted must NOT be manual.

Converted should auto-activate ONLY when:

- Language school payment = marked received
- Darb service fee = marked received
- At least one service attached

If any condition is missing → status cannot change.

---

### When “Converted” activates, system MUST automatically:

1. Trigger influencer commission calculation
2. Start 20-day influencer payout timer
3. Start 20-day referral payout timer (if referral source = student)
4. Calculate team commission
5. Lock case from reverting to earlier status
  - Only Admin override allowed
  - Override action logged

Purpose:

- Prevent manipulation
- Protect commission integrity
- Create reliable accounting logic

---

## 3️⃣ SLA AUTOMATION — DEAD LEAD PREVENTION

### Rule Logic:

If case = Assigned AND:

- Not marked “Contacted” within 24 hours  
→ Highlight case in RED in dashboard
- After 36 hours  
→ Notify Admin automatically
- After 48 hours  
→ Auto-reassign to another available team member

---

### Requirements:

- System must track assignment timestamp.
- Notification should be:
  - In-app alert
  - Email optional (if enabled)
- Auto-reassignment must log reason.

Purpose:  
Speed = trust = revenue protection.

---

## 4️⃣ “MY APPLICATION” TAB RESTRUCTURE

### Current Issue:

Tab lacks defined logic and purpose.

### Required Action:

Rename tab to:

👉 **“My Program Status”**

---

### Display structured progress overview:

- Selected city
- Selected language school
- Course start date
- Accommodation status
- Payment status
- Visa status

This becomes a clear student-facing progress tracker.

Remove any undefined or placeholder elements.

---

## 5️⃣ INFLUENCER DASHBOARD SIMPLIFICATION

### Keep ONLY:

**Overview Section**

- Total Clicks
- Eligible Leads
- Converted
- Conversion %

**Students Tab**

- Student Name (only if consent given)
- Status (Assigned / Contacted / Converted)
- Active payout timer (if applicable)

**Earnings Tab**

- Lifetime earnings
- Pending payouts
- Paid payouts

---

### Remove:

- AI icon
- Non-essential buttons
- Any unclear analytics widgets

Goal:  
Clear dashboards improve performance and trust.

---

## 6️⃣ STUDENT SIDEBAR OPTIMIZATION

### Reorder Sidebar to:

1. Overview
2. My Program Status
3. Visa Checklist
4. My Services
5. My Documents
6. Refer & Rewards
7. Support

---

### Why:

Progress-first structure improves engagement and task completion rates.

This change is structural only.  
No visual redesign required.

---

## 7️⃣ MOBILE TEAM DASHBOARD FIX

### Critical Problem:

Sidebar inaccessible on mobile.

### Required Fix:

- Add hamburger menu
- Add sticky bottom quick-action bar containing:
  - Call
  - Add Notes
  - Mark Contacted
- One-tap access to phone number

Purpose:  
Reduce friction.  
Increase speed.  
Increase conversions.

---

# ✅ STAGE 1 SUCCESS CRITERIA

System should result in:

- Clean unified funnel logic
- Automated commission calculation
- SLA enforcement preventing dead leads
- Clear student progress visibility
- Simplified influencer experience
- Faster team workflow
- Accurate reporting across all dashboards      💰 STAGE 2 — FINANCIAL ENGINE & COMMISSION AUTOMATION
  **Objective:** Build a scalable, fraud-resistant financial backbone.  
  **Important:**
  - No visual redesign unless required for clarity.
  - Focus on backend structure, automation, financial accuracy, and audit safety.
  - All actions must be logged.
  ---
  # 1️⃣ CENTRALIZED MASTER SERVICE ENGINE (ADMIN ONLY)
  ### 🎯 Goal
  Remove manual service logic.  
  All services must be controlled through a centralized Admin table.
  ---
  ## Create: “Master Services Table” (Admin Only)
  Each service must include:
  - Service Name
  - Internal Cost (optional)
  - Sale Price
  - Currency (₪ default, € future-ready)
  - Commission Eligible (Yes/No)
  - Team Commission ( % or Fixed ₪ )
  - Influencer Commission Rule (Fixed / % / None)
  - Refundable (Yes/No)
  - Requires Document Upload (Yes/No)
  - Active / Inactive toggle
  ---
  ### System Rules
  - Services cannot be manually typed.
  - Team must select from dropdown.
  - Admin can edit pricing.
  - Editing price does NOT affect past cases.
  ---
  ### CRITICAL:
  When a service is attached to a student case:
  System must create a:
  ✔ Service Snapshot  
  ✔ Commission Snapshot  
  ✔ Currency Snapshot
  This locks historical integrity and prevents disputes.
  ---
  # 2️⃣ SERVICE ATTACHMENT LOGIC (PROFILE BUILDING)
  When team builds student profile:
  They must choose:
  - Full Package
  - Visa Only
  - Translation Only
  - Custom Selection (multi-select)
  ---
  ### When selection happens:
  System must:
  - Auto-calculate total price
  - Show full breakdown
  - Calculate projected team commission
  - Calculate projected influencer commission
  - Store snapshot at time of sale
  Each student case must store:
  - Service list
  - Price at time of sale
  - Commission structure at time of sale
  - Payment status per service
  No dynamic recalculation allowed after conversion.
  ---
  # 3️⃣ TWO-LAYER PAYMENT SYSTEM
  You have two financial layers:
  ### Layer A — Student → Darb
  (Service Fees)
  ### Layer B — Student → Language School
  (Tuition)
  These must be tracked separately.
  ---
  ## Converted Status Rules:
  Converted activates ONLY when:
  - Layer A = Paid
  - Layer B = Confirmed
  If tuition paid directly to school:
  - Admin uploads proof
  - Admin confirms
  System must not allow manual override without admin log entry.
  ---
  # 4️⃣ INFLUENCER COMMISSION LOGIC (FRAUD-PROOF)
  Commission must NOT depend on clicks.
  Trigger ONLY when:
  - Student status = Converted
  - No refund active
  - 20-day stability timer passed
  ---
  ### Timeline Logic:
  Day 0 → Converted  
  Day 0–20 → Pending  
  Day 20 → Available
  Before Day 20:
  - No payout request allowed
  If refund happens within 20 days:
  - Timer resets
  - Influencer payout cancelled
  - Commission reversed
  System must auto-handle all transitions.
  ---
  # 5️⃣ STUDENT REFERRAL ENGINE (CREDIT-BASED)
  Two referral types:
  ### A) Family Applications
  Group Credit = ₪500 per person
  ### B) Student Refers Friend
  Cashback = ₪500
  ---
  ## IMPORTANT:
  Do NOT reduce service price.
  Instead:
  Create new field:  
  “Credit Balance”
  When referral qualifies:
  - Add ₪500 to credit balance
  - Credit usable toward services OR payout (after conditions)
  Never display “discount”.
  Display:
  - “Referral Credit”
  - “Family Application Benefit”
  ---
  # 6️⃣ TEAM COMMISSION SYSTEM (MOTIVATION + CONTROL)
  Team dashboard must display:
  - Total Revenue Generated
  - Total Commission Earned
  - Pending Commission
  - Paid Commission
  ---
  ## Commission Rules:
  Triggers ONLY when:
  - Student = Converted
  - Refund window closed
  - No dispute flag active
  Admin Controls:
  - Commission Override
  - Commission Freeze
  - Manual Adjustment (with reason log)
  ---
  ### Important:
  Separate:
  Revenue Generated  
  Commission Earned
  If revenue visibility creates confusion, allow admin to hide revenue metric from team view.
  ---
  # 7️⃣ MULTI-CURRENCY INFRASTRUCTURE (FUTURE-PROOF)
  Database must support:
  - Currency field per transaction
  - Exchange rate snapshot
  - Base currency reporting
  Even if currently operating only in ₪:
  Structure must allow:
  - €
  - Future currencies
  Reports must convert to base currency automatically using stored rate snapshot.
  ---
  # 8️⃣ REFUND & DISPUTE SYSTEM (MANDATORY)
  Add refund statuses:
  - Refund Requested
  - Refund Approved
  - Partial Refund
  - Refund Denied
  ---
  ## When refund occurs:
  System must automatically:
  - Reverse team commission
  - Reverse influencer commission
  - Pause payout timers
  - Update financial reports
  - Notify admin
  No manual financial adjustments allowed without audit log.
  ---
  # 9️⃣ PAYOUT REQUEST MANAGEMENT (ADMIN)
  Create two payout tabs:
  1. Influencer Payout Requests
  2. Student Reward Payout Requests
  ---
  Each payout request must display:
  - Full Name
  - IBAN
  - Bank Name
  - Country
  - Amount
  - Source (Influencer / Referral / Credit)
  - Linked Student Case
  - Timer Status
  ---
  Admin Actions:
  - Approve
  - Reject
  - Mark Paid
  - Add Internal Note
  All actions must be logged.
  No deletion allowed. Only status changes.
  ---
  # 🔟 FINANCIAL REPORTING DASHBOARD (ADMIN)
  Admin must have:
  ---
  ### Daily Overview:
  - Revenue Today
  - Conversions Today
  - Pending Payouts
  ---
  ### Weekly Overview:
  - Conversion Rate
  - Top Influencer
  - Top Team Member
  ---
  ### Monthly Overview:
  - Total Revenue
  - Total Commissions
  - Net Profit Estimate
  Net Profit =  
  (Service Revenue – Team Commission – Influencer Commission – Refunds)
  ---
  # 🔐 GLOBAL SYSTEM REQUIREMENTS
  - Every financial event must create a log entry.
  - No deletion of financial records.
  - Only status transitions allowed.
  - All commission calculations automated.
  - No manual math anywhere in system.
  ---
  # ✅ STAGE 2 SUCCESS CRITERIA
  After implementation:
  ✔ Money flow fully automated  
  ✔ Commissions calculated automatically  
  ✔ Refunds protected  
  ✔ No silent financial losses  
  ✔ Tuition & service payments separated  
  ✔ Payouts controlled  
  ✔ Multi-currency ready  
  ✔ Scalable for Germany + global expansion   🔐 STAGE 3 — SECURITY, DATA PROTECTION & LEGAL RISK SHIELD
  **Objective:** Build enterprise-grade protection for identity documents, financial data, and cross-border operations.  
  **Important:**
  - No cosmetic redesign unless required for compliance clarity.
  - All protections must be enforced server-side (not only hidden in UI).
  - Assume high-risk data environment (passports, visa docs, IBAN, cross-border processing).
  ---
  # 1️⃣ ROLE-BASED ACCESS CONTROL (RBAC) — STRICT SERVER ENFORCEMENT
  ## Implement server-side permission matrix.
  ### Admin Permissions
  - Full system access
  - Edit pricing
  - Edit commission structures
  - View & download all documents
  - Approve / reject payouts
  - Override statuses
  - Access audit logs
  - Manage fraud flags
  ---
  ### Team Member Permissions
  - View ONLY assigned cases
  - Edit student profile data
  - Attach services (from master table only)
  - Move status within allowed sequence:  
  Assigned → Contacted → Appointment Set → Converted → Ready for Visa
  Cannot:
  - Edit pricing
  - Edit commission %
  - Approve payouts
  - View influencer bank details
  - Access unrelated cases
  ---
  ### Influencer Permissions
  Can view:
  - Aggregated statistics
  - Student status progress (limited)
  - Earnings breakdown
  Cannot:
  - Download documents
  - View passport info
  - View visa documents
  - Edit data
  ---
  ### Student Permissions
  Access ONLY:
  - Own profile
  - Own documents
  - Own services
  - Own rewards
  - Own referral credit
  No cross-student visibility.
  ---
  ### CRITICAL REQUIREMENT
  All permission checks must be validated on backend API level.  
  UI hiding alone is not sufficient.
  ---
  # 2️⃣ TWO-FACTOR AUTHENTICATION (2FA)
  Mandatory for:
  - Admin
  - Team Members
  Optional but recommended:
  - Influencers
  ---
  ## Implementation Requirements
  - TOTP (Google Authenticator compatible)
  - Backup recovery codes
  - SMS fallback (optional)
  - Admin dashboard access blocked unless 2FA activated
  Store:
  - 2FA activation timestamp
  - Last successful 2FA login
  ---
  # 3️⃣ ENCRYPTION REQUIREMENTS (HIGH-RISK DATA)
  Must encrypt at rest:
  - Passport scans
  - Visa documents
  - Bank IBAN details
  - Income proof documents
  ---
  ## Encryption Standard
  - AES-256 encryption
  - Secure object storage (no public URLs)
  - Signed download URLs
    - Expire within minutes
    - Single-use if possible
  Never allow:
  - Permanent public document links
  - Direct storage bucket exposure
  ---
  # 4️⃣ FULL AUDIT LOG SYSTEM (NON-NEGOTIABLE)
  Every sensitive action must log:
  - User ID
  - Role
  - Action performed
  - Resource accessed
  - Timestamp
  - IP address
  - Device info (if available)
  ---
  ### Log the following actions:
  - Viewing passport
  - Downloading document
  - Changing commission %
  - Editing service pricing
  - Marking Converted
  - Approving payout
  - Editing bank details
  - Refund approval
  - Status override
  Audit logs:
  - Immutable
  - Not deletable
  - Admin-readable only
  ---
  # 5️⃣ DATA RETENTION POLICY SYSTEM
  Implement lifecycle-based retention rules.
  Example structure:
  - Active Students → Full storage
  - Graduated Students → Archive after 1 year
  - Archived Records → Delete after 3–5 years (configurable)
  ---
  ## Additional Requirements
  - Add “Delete My Data” request button
  - Admin review before permanent deletion
  - Log deletion event
  - Notify user upon completion
  Never store documents indefinitely without policy.
  ---
  # 6️⃣ CONSENT & LEGAL AGREEMENT LAYER
  At student registration:
  Require checkboxes:
  ☑ Consent to contact  
  ☑ Consent to document processing  
  ☑ Acceptance of Privacy Policy
  ---
  System must store:
  - Timestamp
  - IP address
  - Policy version number accepted
  If policy updates:
  - Force re-consent
  - Track version change
  ---
  # 7️⃣ GDPR-AWARE STRUCTURE (ISRAEL → GERMANY / EU)
  Even if company operates in Israel, system must support:
  - Data access request
  - Data correction request
  - Data deletion request
  - Export personal data (machine-readable format)
  Privacy policy must be available in:
  - Arabic
  - Hebrew
  - English
  Store:
  - Language of consent version accepted
  Prepare for EU compliance expansion.
  ---
  # 8️⃣ FRAUD PREVENTION LAYER
  Implement backend fraud detection flags:
  Trigger alerts if:
  - Same IBAN used in multiple accounts
  - Same passport uploaded twice
  - Rapid referral chains
  - Multiple applications from same IP
  - Unusual commission spikes
  ---
  ## Admin Dashboard Addition:
  Create:  
  ⚠ Fraud Alert Panel
  System flags cases for manual review.  
  Do NOT auto-block without review.
  All fraud flags logged.
  ---
  # 9️⃣ SECURE PAYMENT HANDLING
  Never store:
  - Full credit card numbers
  - CVV codes
  When integrating payment gateway:
  Use:
  - Tokenized payments
  - PCI-compliant provider
  System stores ONLY:
  - Transaction ID
  - Status
  - Amount
  - Timestamp
  - Currency
  No raw card data retention.
  ---
  # 🔟 BACKUP & DISASTER RECOVERY
  Implement:
  - Daily automated database backup
  - Weekly full system backup
  - Offsite encrypted storage
  - Quarterly restore test
  Backup logs must show:
  - Last successful backup time
  - Backup size
  - Integrity check result
  System must survive total server failure without document loss.
  ---
  # 1️⃣1️⃣ MOBILE UPLOAD SECURITY
  For student uploads:
  - Limit file size
  - Accept only: PDF, JPG, PNG
  - Automatic virus/malware scan
  - Confirm upload success visually
  - Prevent rapid re-upload spam
  - Enforce rate limits
  Store:
  - Upload timestamp
  - File hash (for duplication detection)
  ---
  # 1️⃣2️⃣ SENSITIVE UI REDUCTION
  Remove from influencer view:
  - Eye color
  - Height
  - City of birth
  - Any visa-specific fields
  - Any biometric details
  Full visa data visible ONLY to Admin.
  ---
  # 1️⃣3️⃣ LEGAL RISK SHIELD (TERMS & CONDITIONS UPDATE)
  Add clear legal statements:
  - Darb operates as educational advisory service
  - Final visa decision rests with embassy
  - Language school acceptance determined by institution
  - Refund conditions clearly defined
  - No guarantee of visa approval
  Require explicit acceptance at signup.
  Log acceptance timestamp + policy version.
  ---
  # 🔒 GLOBAL SECURITY REQUIREMENTS
  - No document stored without encryption
  - No financial data editable without audit log
  - No status override without log
  - No commission change without admin authorization
  - All sensitive endpoints protected with role validation middleware
  ---
  # ✅ STAGE 3 SUCCESS CRITERIA
  After implementation:
  ✔ Zero accidental data exposure  
  ✔ Server-side permission enforcement  
  ✔ Full audit trail  
  ✔ GDPR-aware structure  
  ✔ Fraud detection visibility  
  ✔ Backup resilience  
  ✔ Reduced legal vulnerability  
  ✔ Investor-grade infrastructure 