# Fix "Edge function returned a non-2xx status code" on Refer & Register

## What's happening (confirmed from server logs)
Every recent failed attempt was rejected by the server with the same reason: **"This person already has a DARB case"**. The friend's email or phone number matches a case that already exists — most likely the "Test Referral Darb" case left from my earlier test, or a real existing student.

The page hides that reason. It shows the generic "non-2xx status code" text because it reads the error's surface message instead of the server's actual message. The project already has a helper that reads the real message; this page doesn't use it.

## Fix
1. **Show the real reason.** On the Refer page, both the "Register" button and the "Pay by card" button will show the server's own message (for example "This person already has a DARB case") instead of the generic error.
2. **Friendly duplicate message.** When the friend already has a case, show a clear translated message (Arabic, English, Hebrew): "This friend is already registered with DARB. Contact the team if you think this is a mistake."
3. **Stricter duplicate matching.** Make sure an empty phone number can never match another case's empty phone (only compare phones when both have digits). Small database update, no data changed.
4. **Test record.** Delete the "Test Referral Darb" test case, invoice and payment — only if you approve — so you can reuse that email/phone for testing.
5. **Verify** by submitting a new friend (new email/phone) as student@gmail.com and confirming the case and invoice are created, and that a duplicate shows the friendly message.

## Technical details
- `ReferralRegistrationFlow.tsx`: replace `error?.message` with `await readFunctionError(error)` (from `src/lib/functionError.ts`) in submit and card checkout catches; map the duplicate string to `referralRegistration.errors.duplicate` in en/ar/he, both `public/locales` and `src/locales`.
- Optionally return `code: "DUPLICATE_CASE"` from `create-student-referral-registration` (409) so the client routes on a code, not text; redeploy the function.
- New migration (unique newer timestamp) redefining `create_student_referral_registration_internal` with the phone clause guarded by `length(digits) >= 7` on both sides.
