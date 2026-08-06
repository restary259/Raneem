# Phase 2 — Configurable pipeline statuses (+ Phase 1 checkup)

## 1. Checkup of what shipped in Phase 1 (verified)

- Indexes: 30 indexes now exist across `cases`, `profiles`, `documents`, `leads` — the ones the roadmap listed are in place.
- `cases` has `case_reference`, `archived`, `archived_at`. No case is archived yet (0 of 2), so nothing has silently disappeared from any list.
- Pagination is live on Admin Students and Admin Submissions; the pipeline board caps cards per column with a translated "Show more".
- Archived cases are excluded from the pipeline board and from partner/team fetches. Admin financial totals still include them on purpose, so revenue history never changes when a case is archived.
- Typecheck passes clean.
- Not built yet (correct — later phases): `pipeline_statuses`, `case_events`.

## 2. What the "25 / 50 / 100" control under Submitted Requests is

It is the **rows-per-page** selector for that list. It does not change any data, only how many case rows are drawn at once:

- `25 / page` → the list shows 25 cases, then `1 / 3` and arrows to move between pages.
- Changing it to 50 or 100 shows more rows per page and fewer pages.
- The line on the left ("Showing 1–25 of 62") is the current window.
- Pending and Completed tabs each have their own independent pager.

With only a handful of cases today you will see `1 / 1` and no visible effect — it exists so the page stays fast at thousands of cases. If you would rather not see it until it matters, we can hide the whole control when the total fits in one page. Say the word and I will add that.

## 3. Do we need an event-based timeline?

Short answer: yes, but it is Phase 3, not now.

Today history is scattered: `activity_log` (status changes), `admin_audit_log` (admin actions), plus ad-hoc "last activity" fields. Nobody can open one case and read its full story in order — who called, when the profile was filled, when payment landed, when the visa status moved.

The value once it exists:
- One "Case timeline" panel on the admin, team and student case pages.
- Answers "what happened to this student" in seconds instead of cross-reading three tables.
- Makes handover between team members safe when you grow the team.

It is worth doing, and Phase 2 makes it cleaner (status changes get logged against a real status record instead of a loose string). So: finish Phase 2 now, then Phase 3 timeline.

## 4. Phase 2 — the work

Goal: the 9 pipeline stages stop being hardcoded in the app and become rows you can rename, recolor, reorder and deactivate from the admin settings page. Nothing changes visually on day one.

### Database (one migration)

New table `pipeline_statuses`:

| field | meaning |
| --- | --- |
| `key` | the value stored on `cases.status` (unchanged: `new`, `contacted`, …) |
| `label_ar`, `label_en` | display names you can edit |
| `color` | badge color from a fixed palette |
| `sort_order` | column order on the board |
| `is_terminal` | end-of-pipeline stage (`enrollment_paid`, `cancelled`, `forgotten`) |
| `is_active` | hidden from the board when off |

- Seeded with exactly today's 9 statuses, today's order, today's colors and today's Arabic/English labels.
- `cases.status` stays plain text — no data migration, no risk to existing cases.
- Everyone signed in can read the table; only admins can write it.
- A guard prevents deleting or deactivating a status that still has cases in it, and prevents changing a `key` at all (keys are the link to existing cases).

### Code

- `src/lib/caseStatus.ts` keeps the current enum as a **fallback** and gains a runtime loader, so if the table is unreachable the app behaves exactly as today.
- New `usePipelineStatuses()` hook (cached, refreshed on change) feeding the pipeline board, status badges, filters and the case detail pages.
- New admin screen under `/admin/settings` → "Pipeline stages": edit Arabic/English label, pick color, drag/reorder, toggle active, with the case count per stage shown so you can see what you are about to hide.
- All new strings via `t()` in `ar` + `en`; numbers `en-US`.

### Verification before I call it done

- Typecheck + existing vitest/Playwright suites.
- Board, admin submissions, team dashboard, student progress bar all still show the same 9 stages in the same order and colors.
- Rename a stage in settings → the new label appears everywhere without a rebuild.
- Deactivating a stage with cases in it is refused with a clear message.

## 5. What stays untouched in this phase

Sequential pipeline rules, commissions, payouts, referral attribution, RLS scoping for team/partner, and the audit logs. Phase 2 is labels and ordering only.
