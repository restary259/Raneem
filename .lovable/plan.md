# Admin Submissions — fix enrollment crash + simplify actions

## What's broken

Confirming enrollment fails with a 500 and a blank screen:
`record "v_offer" is not assigned yet`.

Confirmed root cause (read from the live database, not guessed):
the `get_effective_partner_split` function declares a record variable `v_offer`, but only
fills it **when the partner has a master partner**. When the partner has no master partner
(which is the case for the demo partner, and for every ordinary partner today), the function
still reads `v_offer.id` — and Postgres raises "record is not assigned yet". Because this runs
inside the commission split, the whole "mark as enrolled / confirm payment" call aborts.

So today: **no case with a partner can be marked as enrolled.** This is not a UI bug.

## Fix 1 — partner split function (database)

Rewrite `get_effective_partner_split` so it never reads an unassigned record:

- Track whether an accepted rate offer was found with an explicit flag (`FOUND`) instead of
  probing `v_offer.id`.
- No-master partner: return the full base pool to the partner, master share 0, no offer fields.
- Master partner with no accepted offer: same, but return the master id.
- Master partner with an accepted offer: pool split as today (partner amount capped at the pool,
  remainder to the master).

Money rules are unchanged — the pool is never exceeded, no new money is created.

## Fix 2 — remove Approve / Request changes from Submissions

Remove from the submission detail dialog:

- the "Request changes" button and its dialog
- the "Approve" button and its dialog
- the now-unused state, handlers and imports

The only remaining actions become **Open full case** and **Mark as Enrolled**.

Important consequence to decide on: today the **Approve** dialog is what creates or links the
student's account (it asks for the student email). Removing it removes the only place the
student account gets created from this page. Plan: move that step into the enrollment
confirmation flow — when marking a case as enrolled, if the student has no account yet, the
same email field appears there, so account creation still happens exactly once, at the point
where the case actually becomes real.

Requesting changes stays available on the full case page (that RPC is untouched); only the
duplicated buttons on the submissions list go away.

## Fix 3 — dashboard layout hook crash

A "Rendered more hooks than during the previous render" error is firing from
`DashboardLayout`. Audit the hook order there (the master-partner and unread-message hooks are
called after conditional branches) and make every hook unconditional at the top of the
component.

## Verification

- Re-run the enrollment confirmation on a partner-attributed case and confirm it returns 200.
- Show the real reward rows created for that case and confirm team + partner + any master
  override never exceeds the fee actually charged.
- Confirm the submissions dialog now shows only the two remaining actions, in Arabic and English.
- Run the existing test suite and the type-check.

## Technical notes

- Files: `supabase/functions/admin-mark-paid/index.ts` (unchanged logic, verified), a new
  migration replacing `public.get_effective_partner_split`, `src/pages/admin/AdminSubmissionsPage.tsx`,
  `src/components/layout/DashboardLayout.tsx`, plus removal of unused
  `admin.submissions.approve*` / `requestChanges` keys from the locale files.
- `record_case_commission` itself needs no change; it only breaks because of its call into
  `get_effective_partner_split`.
