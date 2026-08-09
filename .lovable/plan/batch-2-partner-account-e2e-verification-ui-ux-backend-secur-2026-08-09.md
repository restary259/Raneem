# Batch 2 — Partner account: E2E verification, UI/UX, backend & security

Scope is the Partner (and ambassador) experience only, plus one UI fix in the admin "Create Member" dialog. No Batch 3 work, no pipeline or commission-architecture redesign.

## 0. Fix the Create Member dialog (immediate)

Problem seen in the screenshot: after an invitation is sent, the dialog still says "Create Member", the activation URL is squeezed into one truncated line inside an RTL container, and the only copy affordance is a small icon.

Fix in `src/pages/admin/AdminTeamPage.tsx` (presentation only):
- Success state gets its own title ("Invitation sent" / "تم إرسال الدعوة") and a success icon instead of reusing the create title.
- Activation link rendered in a `dir="ltr"`, wrapping, selectable code block so the whole token is readable in both languages.
- Full-width "Copy link" button with a visible label plus a secondary "Open link", and a clear copied confirmation.
- Same treatment for the temporary-password success state (label + copy button, monospace value).
- New Arabic/English keys in `public/locales/{ar,en}/dashboard.json`.

## Step-by-step plan (report after each step, no auto-continue)

**Step 1 — Audit only.** Read every partner surface and report findings before touching code: routes in `src/App.tsx` (`/partner`, `messages`, `students`, `earnings`, `network`, `performance`), `PartnerDashboardLayout`, nav config in `DashboardLayout.tsx`, the five partner pages, `ReferralLinkCard`, `RateOfferInbox`, and the backend it calls (`get_partner_pool_cases`, `get_my_role`, `platform_settings`, `partner_commission_overrides`, `rewards`, `partner_links`, `partner_rate_offers`), plus partner-related RLS. Report architecture, what works, what is broken/legacy/duplicated, and any missing backend enforcement. No changes.

**Step 2 — Real login test.** Sign in as the demo partner in a headless browser against the running app, confirm role detection, correct dashboard, no student/team/admin surface, no redirect loop, no forced password screen, no stuck loading; then refresh, log out, log back in.

**Step 3 — UI/UX audit and targeted fixes.** Desktop and mobile passes over every partner page, checking empty/loading/error states, dead buttons, labels, translations, currency (₪, en-US digits) and date formatting. Fix only genuine defects; keep the existing design language.

**Step 4 — Data-source verification.** For each KPI on Overview, Students, Earnings, Network and Performance, trace displayed value to its query/RPC and confirm it matches the database. Fix the source, never the displayed number, when they disagree.

**Step 5 — Isolation testing.** Attempt cross-partner access from the partner session (other partners' cases, rewards, payout requests, profiles, threads) via direct API calls and URL/ID manipulation. Any leak is fixed in RLS or the RPC with a tracked migration.

**Step 6 — Partner profile.** The partner role currently has no profile/account page (only student has one). Add a single `/partner/profile` page and nav entry reusing the existing dashboard patterns: name, phone, preferred contact, read-only email and role, with validation, save feedback, and a check that saved values survive a refresh. Confirm the existing `restrict_profiles_write` trigger still blocks role/financial field edits.

**Step 7 — Commission/KPI verification.** Verify only: rate resolution (platform default vs per-partner override vs ambassador rate), paid vs pending amounts, payout request states, currency and formatting. Document pipeline dependencies for the later finance batch; change nothing structural.

**Step 8 — Referral link.** Verify uniqueness, persistence across refresh and re-login, correct `/apply?ref=` target, and that a real application through the link is attributed to this partner in the database.

**Step 9 — Chat access.** Verify partner threads load, send/receive works, and that admin-only, team-only, other-partner and unrelated case conversations are unreachable from the partner session.

**Step 10 — Notifications.** Verify partner notifications come from real events, target the right recipient with a working link, respect read/unread, and are not duplicated; check push permission state. Document anything belonging to the global notification batch.

**Step 11 — Mobile E2E.** 390px-wide run through login → dashboard → profile → KPI → referral → chat → notifications → logout, hunting horizontal scroll, overflow, small touch targets, broken dropdowns/modals and clipped text.

**Step 12 — Security review.** Focused review of everything touched: auth, role enforcement, RLS, RPC authorization, referral attribution, profile updates, chat and KPI queries, ID/URL access, session handling. Any client-side-only authorization gets a backend guard; schema changes go through a tracked migration.

**Step 13 — Verified legacy cleanup.** Remove only partner-related code proven unused (no route, import, or role depends on it). Anything unsafe to remove stays and is documented.

**Step 14 — Full partner E2E.** Invitation → password → login → dashboard → refresh → profile save → KPI → referral attribution → chat → notifications → mobile → logout → login, with a database check that UI and backend agree.

**Step 15 — Final report.** Per-step status plus files changed, migrations, backend functions changed, security findings, remaining issues and deferred work.

## Technical notes

- Partner and ambassador share `PartnerDashboardLayout`; nav lives in `NAV_CONFIG` in `src/components/layout/DashboardLayout.tsx`, with master-partner-only Network/Performance entries appended.
- Case data reaches the partner through the `get_partner_pool_cases` RPC (reduced columns, no phone/notes) with a pool/referral mode derived from `platform_settings.partner_dashboard_show_all_cases` and `partner_commission_overrides`.
- Any schema or policy change in Steps 5, 6 or 12 is issued as a tracked migration, with grants for `authenticated`/`service_role` on any new object.
- Verification is done with real browser runs and database reads; nothing is marked done without evidence.
