# Refer & Register: student submits, pays and uploads the receipt; admin handles everything after (in /admin/referrals); the case goes straight to payment

## What I checked first
- **New registrations start at "New".** That puts them in the normal pipeline next to ordinary leads, with "contacted" and "appointment" steps that don't apply to them.
- **Confirming a bank transfer only moves the case from "New" to "Profile".** It never reaches "Payment confirmed", so the case gets stuck there.
- **No receipt upload exists today.** The invoice page only has an "I made the transfer" button.
- **Card payment buttons still show** in two places: the registration success screen and the public invoice page. Stripe isn't set up, so these can't work anyway.
- **The code and the database disagree.** The case page calls a "submit registration for review" step that doesn't exist in the live database. Three other database steps the brief mentions are also missing.
- **Current data:** one referral case (now at "Contacted") and one unpaid registration invoice. No card payments have ever been made.

## Changes

### 1. Registration flow (student)
- A new registration starts at **Profile**, because the form already collected everything.
- The success screen shows:
  - "Registration complete — payment is the next step"
  - case reference, invoice number and amount due
  - bank details
  - **Upload transfer receipt**
  - **Contact DARB**
- The card option is removed from the success screen and the invoice page. The "I made the transfer" button is replaced by the receipt upload.

### 2. Receipt as a normal document
- The receipt is saved in the existing student documents area, labelled "Bank transfer receipt". There's no approval step.
- It appears right away on the student's Documents page, and for the assigned team member and admins.
- The server decides which case a receipt belongs to; nothing the browser sends is trusted for that. Uploading a receipt marks the transfer as "submitted" only. **It never counts as paid.**

### 3. Finance confirms, then the case moves
- When an admin (or the assigned team member) confirms the transfer, the invoice is marked paid and the case moves **Profile → Payment confirmed**. After that it follows the normal steps: Submitted, then Enrolled.
- The referral reward is still paid only at Enrolled, and only once. This logic stays as it is.

### 4. Admin: referrals get their own queue
- The normal pipeline and its counters (command centre, backlogs, response-time targets) leave out Refer & Register cases. They are hidden only from that view; nothing is deleted or archived.
- **Referrals (/admin/referrals) becomes their home.** Each row shows:
  - student, referrer, type, school/course, invoice and amount
  - a clear status: Payment pending → Receipt uploaded, awaiting finance → Payment confirmed → Submitted → Enrolled
  - links to open the case and the receipt
- The case page drops the "submit for review" wording and its broken button for these cases.

### 5. Student dashboard
- Remove the "Identity information" section (nationality, eye colour) from the student's profile page. The saved values stay, and visa, admin and onboarding still use them.
- New Next Steps task, **Planned arrival date**. It has a date field and a Save button, and disappears once saved. It doesn't touch the visa, the actual arrival date or the case stage.
- Remove the "One DARB record" text.

### 6. Translations
All new and changed text in Arabic, English and Hebrew.

## Database (you run it)
I'll give you one new SQL file in the usual manual folder. It will:
- start new registrations at Profile
- move the case to Payment confirmed when finance confirms
- add the server step that saves a receipt and links it to the right case
- reject any new card payment attempts, while keeping card history intact
- include the student permission part of the pending payment-proofs file, since receipts need it

It deletes no data. The existing case at "Contacted" stays as it is unless you tell me to move it.

## Tests
- A new registration starts at Profile and never appears in the normal pipeline.
- Uploading a receipt never marks the invoice paid; only finance confirmation does, and that moves the case to Payment confirmed.
- Nobody can upload to, or read, another student's case.
- No card button appears anywhere in this flow, and the server rejects card attempts.
- The reward still happens only at Enrolled.
- Profile page: no Identity section. Arrival task: appears, saves, then disappears.
- Typecheck, the related unit tests, and a browser walkthrough after you run the SQL.

## Technical details
- Live `create_student_referral_registration_internal(p_referrer_user_id, p_data)`: set `status='profile_completion'`.
- Live `confirm_registration_payment`: replace `new→profile_completion` with `profile_completion→payment_confirmed` via the controlled transition (respect `enforce_case_stage_transition`), and log the event.
- New SECURITY DEFINER `submit_registration_receipt(p_token text, p_file_path text)`: resolves the case/student from the token, enforces caller = student on the case (or the assigned team member/admin), inserts a `documents` row (type `bank_transfer_receipt`, existing bucket/path shape), and creates or updates a `case_registration_payments` row with status `submitted`. Idempotent per invoice.
- `create_registration_card_payment_internal` raises "Card payments are no longer supported"; the Stripe edge functions return 410; the frontend `stripe-student-referral-checkout` calls are removed. Historical rows are untouched.
- `CaseService.listActive()` adds `.neq('source','student_referral_registration')` (nulls kept with an `or`); the Command Center queries get the same filter.
- `CaseDetailPage` / `SubmissionCaseTabs`: remove the call to the missing `submit_student_referral_registration_for_review`.
- `StudentProfile.tsx`: remove lines ~305–330. `StudentNextStepsPage.tsx`: select `arrival_date`, add the task with a native date input and an update scoped to own profile via `StudentService.updateProfile`.
- SQL file: `docs/manual-sql/20261004170000_referral_direct_to_finance.sql`. It includes the `can_read_case` part of `20261004150000`.
