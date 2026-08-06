# Final Translation Audit + Production Readiness Pass make sure the missing keys are active code not dead code 

## What the audit found

I scanned every `t('...')` call in the app against the Arabic and English dictionaries.

**~326 translation keys are missing in Arabic and ~338 in English.** When a key is missing, the raw key string is rendered on screen — this is exactly the "mistakes" visible in the Applications Inbox.

Applications Inbox specifically: the whole `admin.contacts.*` group is missing in both languages, so the search box, export button, status badges, "mark replied", "archive", delete dialog and empty state all print raw keys. On top of that, each submission shows its raw database field names (`education_level`, `still_in_school`, `source`) and the raw form origin (`partnership_form`) instead of readable labels.

Largest missing groups (both languages):


| Area                                                                    | Missing keys |
| ----------------------------------------------------------------------- | ------------ |
| Leads management                                                        | 48           |
| Custom notifications                                                    | 17           |
| Eligibility config                                                      | 16           |
| Security panel                                                          | 14           |
| Admin password confirm                                                  | 10           |
| Applications Inbox / contacts                                           | 9            |
| Team, checklist, audit log, shared dialogs                              | ~30          |
| Financials, payouts, submissions, analytics                             | ~17          |
| Student dashboard (profile, rewards, documents, application, checklist) | ~40          |
| Partnership & public pages (whatIsIt, whyPartner, cards, WhoWeAre)      | ~12          |


## What I'll do

### 1. Fix the Applications Inbox properly

- Add the full `admin.contacts.*` group in Arabic and English.
- Show readable labels for each answer in a submission instead of database field names (full name, city, education level, English/Math units, preferred major, interested country, service, message, still in school, etc.), with yes/no and option values translated.
- Show a translated badge for the form origin (Partnership application / Contact message) instead of `partnership_form`.
- Translate the status values (new / replied / archived) including the fallback branch.

### 2. Fill every missing key across all dashboards

Add all missing keys to both `ar` and `en` dictionaries, grouped by area — admin (leads, notifications, eligibility, security, password confirm, team, checklist, audit, shared dialogs, financials, payouts, submissions, analytics, influencers, partner payouts), student dashboard (profile, rewards, documents, application, checklist, referrals), team/lawyer, and the public partnership pages.

Arabic is the primary language and gets natural, professional wording — not machine-literal strings. English mirrors it.

### 3. Guard against regressions

Add a test that walks every `t('...')` call in the source and fails if a key is missing from either language, so this can't silently come back.

### 4. Production readiness deep audit

After the translation work, run and report on:

- Full type check and the existing unit + end-to-end suites.
- Database linter and security scan; list anything unresolved with severity.
- Review of the key money paths (commission split, payout locking, VAT) and the case pipeline transitions.
- Public-page and metadata check (titles, descriptions, sitemap, robots).
- A written go / no-go verdict with any remaining blockers.

## Technical notes

- Only locale JSON files, `ContactsManager.tsx`, `AdminInboxPage.tsx`, and one new test file get touched for the translation work. No schema, RLS, or edge-function changes.
- Field-label mapping for submissions lives in a small map keyed off the stored field names, translated through `t()` — no inline Arabic strings in components.