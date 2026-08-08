# Darb — Catalog Data, Case Page Rebuild, and Phase C (Inbox / Secure Chat)

Three parts, in this order: load the real school data into the admin dashboard, rebuild the case detail page based on the audit below, then move to the next blueprint step (Inbox / secure chat).

---

## Part 1 — Load the German school data into the admin dashboard

The comparison document covers 4 real schools. The catalog tables (`schools`, `programs`, `accommodations`) are currently empty — 0 rows each — so the admin Programs page has nothing to manage and the team has nothing to attach to a case.

**Schools to load (4):** GoAcademy (Düsseldorf), KAPITO (Münster), F+U Academy (Heidelberg), Alpha Aktiv (Heidelberg). "Scarb" is skipped — the document confirms no such school exists.

**Courses to load (~9):** each school's 20 lessons/week intensive plus its premium variant (24 / 25 / 30 L/W), with CEFR range, hours per week, start-day rule (every Monday; A1 first Monday of the month where applicable), registration fee, and visa/exam notes.

**Accommodation to load (~25):** apartments, studios, dorms and host-family options per school with their weekly prices, deposits, placement fees, meals and distance notes.

Pricing in the source is tiered by stay length (e.g. Alpha Aktiv €215 for 1–3 weeks down to €150 for 25+ weeks). Today `programs.price` and `accommodations.price` hold one number only. Plan: add a `price_tiers` JSON column to both tables, store the full tier ladder there, and keep `price` as the headline (shortest-stay) price so nothing that reads `price` today breaks. Currency stays EUR for catalog items; case financials stay in ₪.

**Admin Programs page changes**
- Group courses and accommodation under their school instead of one flat list.
- Show the tier ladder in the row and let admin edit tiers in the dialog.
- Show registration fee / deposit / placement fee and meals as explicit fields.
- Full Arabic + English labels for every new field; prices formatted with `en-US` digits.

Source notes (accreditation, cancellation policy, contact email/phone) go into the school description so the team can quote them without leaving the app.

---

## Part 2 — Case detail page: audit, rating, and rebuild

### Rating: 5.5 / 10

Solid data plumbing, weak as a work surface. Specific problems found:

| # | Problem | Where |
|---|---|---|
| 1 | Overview tab repeats fields already shown in the Student tab and in the page header | `CaseDetailPage.tsx` summary grid |
| 2 | A Documents card sits inside the Overview tab with no upload control — read-only list, nowhere to put a file | `CaseDetailPage.tsx` |
| 3 | The Activity tab holds both an Appointments card and the full timeline; the timeline repeats what the attention panel and appointments card already say | `CaseDetailPage.tsx`, `CaseTimeline.tsx` |
| 4 | "Passport missing" is raised as a blocking task even though passport data is collected in the profile-completion step | `caseTasks.ts` |
| 5 | No way to move the case to the next stage by hand — the rail shows the pipeline but is not actionable | `CaseProgressRail.tsx` |
| 6 | Five tabs for a page that has three real jobs (know the student, sell/attach services, get paid and submit) | `CaseDetailPage.tsx` |
| 7 | Attention panel and tab content both offer the same actions, so the same button appears twice on screen | `CaseAttentionPanel.tsx` + tabs |

### Rebuild

- **Drop the Documents card** from the case page. Documents belong to the student record; the case page instead shows a one-line "3 documents on file" link into the student's document area.
- **Drop the Activity tab and the timeline** from the case page. Event history stays recorded in the database and stays visible in the admin activity log — it just stops competing for space on the working surface.
- **Remove the passport requirement** from `caseTasks.ts`. Profile completion already covers it, so it no longer blocks submission to admin either.
- **Add an explicit "Move to next stage" control** on the header rail. It advances one step along the configured pipeline, shows exactly what is blocking when it is disabled, and refuses to skip stages — the pipeline rule stays enforced in the backend.
- **Collapse five tabs into three:** Student (identity + contact + profile fields), Services & Program (school, course, accommodation, insurance from the Part 1 catalog), Financial Summary (services total, discounts, paid, outstanding).
- **Keep one appointments strip** in the header area — next appointment plus a record-outcome action — instead of a whole tab.
- **Attention panel stays** as the only place that proposes actions, so nothing is offered twice.
- Re-check every label in Arabic and English, RTL layout, loading/empty/error states, and `en-US` number and date formatting.

---

## Part 3 — Next blueprint step: Inbox / Secure chat (Phase C)

Per the blueprint's implementation order, step 8 after the student-account flow.

- Admin ↔ Team direct conversations. Admin picks any team member; a manager can reach all team members. Team-to-team is blocked by default, with an admin-granted exception flag.
- A conversation can be linked to a case, and the case page gets a "Discuss with admin" entry point that opens that thread.
- Messages carry text plus image/document attachments, stored in a private bucket.
- Unread counts surface in the admin command center and the team work page.
- All authorization enforced in the database, not the UI.

---

## Technical notes

- Migration 1: `price_tiers jsonb` on `programs` and `accommodations`; extra fee/meal columns on `accommodations`.
- Data load: catalog rows inserted through the data tool, not a schema migration.
- Migration 2 (Part 3): `conversations`, `conversation_participants`, `messages` tables with grants, RLS scoped to participants, and a chat-attachments storage bucket with matching policies.
- `caseTasks.ts` unit tests updated for the removed passport rule; Playwright case-flow specs updated for the three-tab layout.
- Deleted with their replacements: the case-page timeline usage and the case-page documents card. `CaseTimeline.tsx` is removed if nothing else renders it.
