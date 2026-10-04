# Payment proof uploads + Kheir's Students tab: audit and fix

## What I found

1. **Uploading on the Fees page doesn't work.** The page puts the file in a different storage folder (`student-documents`) from the one the proof system checks (`case-payment-proofs/<case>/<payment>/…`). It also calls the old version of the submit step. So the save step rejects the file with "Invalid payment proof path".
2. **Even a saved proof would stay invisible to the student.** The student read rules for proofs (and invoices) check the case record first. Students aren't allowed to read their case record, so these checks always come back empty. That's why no checkmark appears and the invoice is hidden too.
3. **Team access is too narrow.** Only the assigned team member (Kheir for Tsukuyomi) and admins can see proofs. That matches "only team related to this student" and stays as it is.
4. **Tsukuyomi doesn't show in Kheir's Students tab.** The tab only lists students whose account records "created by". Accepting an invitation never fills that in. So every invited student is missing; today that's Tsukuyomi, the only invited student.

## Changes

### A. Upload works, with a confirmation mark (Fees page)
- Upload each school-cost proof (course, accommodation, insurance) to the proofs folder for its payment line, then save it with the matching submit step.
- After a successful upload, show a green check and "Uploaded, waiting for review", plus the file name and a "View file" link. A rejected proof still shows the reason and "Upload replacement". A confirmed one shows "Payment confirmed by Admin".
- Show a red message (not a browser pop-up) if the upload fails.

### B. Proofs appear in more places
- **Student Documents page:** a new "Payment proofs" section listing each uploaded proof with its status and a View button.
- **Team (assigned member only):** the student's profile / case view lists the proofs with View. Only the team member assigned to that case can open them.
- **Admin:** proofs are listed in the existing payment review area with View, Approve and Reject.

### C. Student read access (database, you run it)
- Add one narrow helper, "is this my case?" (student or assigned team member). Switch the student/team read rules for invoices, payment proofs and the proof files to use it. Students still can't read the case record itself.
- This replaces the invoice fix I sent earlier, so you only run this one.

### D. Kheir's Students tab
- When a student accepts an invitation, record the inviting team member as "created by". Do this only if it's empty, so existing values are never overwritten.
- Fill in the missing value for students who already accepted, based on their accepted invitation. That's currently Tsukuyomi, linked to Kheir. This needs your OK because it changes existing data.
- On the Students tab, also show students whose case is assigned to the signed-in team member, so assigned students never go missing.

### E. Translations
- New text in Arabic, English and Hebrew.

## How I'll check it
- Sign in as Tsukuyomi: upload a test PDF for the course, see the checkmark, see it on the Documents page, and open the invoice.
- Sign in as Kheir: see Tsukuyomi in Students and his proof on the case. Confirm another team member can't see it.
- Run the typecheck and the related tests.

## Technical details
- Upload path: `case-payment-proofs/{case_id}/{payment_id}/{ts}_{name}`. Use the `case_payments` row whose `payment_type` is in `school_course | school_accommodation | school_insurance`, and call `submit_case_payment_proof(p_payment_id, p_file_path)`.
- Manual migration: add the SECURITY DEFINER `can_read_case(_case_id)` (EXECUTE for authenticated only). Recreate the SELECT policies on `case_invoices` and `case_payment_proofs`. Add a storage SELECT policy for case members on `case-payment-proofs`. Update `accept-invitation` / acceptance to set `profiles.created_by = inviter_id` when null. Backfill with an UPDATE scoped by `created_by IS NULL` joined to accepted `user_invitations`.
- Viewing files uses signed URLs.
- Team Students query becomes: `created_by = me` OR the student has a case with `assigned_to = me`.
