# Payment split accuracy + German payment confirmations

Two separate fixes: (1) the Payment Split preview does not match what the money engine actually pays for partner / ambassador / agent-referred cases, and (2) German-side confirmations should require the language course and accommodation, while insurance stays optional (it is paid after arrival in Germany).

## Part 1 — Payment split must reflect each case's real commission settings

### What is wrong today (verified against the live engine)

The split panel in Admin › Submissions rebuilds the commission math in the browser. Compared to the server engine (`record_case_commission`), it diverges in four ways:

1. **Partner/ambassador with no per-account override shows ₪0.** The preview only pays a commission when a row exists in `partner_commission_overrides`. The engine falls back to the global rate, and for ambassadors it uses the ambassador rate, not the partner rate. So most correctly-attributed cases preview as ₪0 and then pay a real amount.
2. **The preview filters by case source.** It hides the commission when the case source is not in the partner's visibility list. The engine has no such rule — visibility controls what a partner can *see*, never what they are *paid*.
3. **Agent self-referrals show nothing.** When the referrer is an agent (their own apply link), the engine pays the agent self-referral rate. The preview treats the agent as a partner, finds no override, and shows ₪0.
4. **Student referrals show nothing.** The engine pays a friend/family student referral reward; the preview has no line for it.

Cases from a partner or ambassador who was recruited by an agent are handled in the preview (the extra agent recruitment amount is shown, additive, on top of the partner's amount) — that part already matches the engine and stays.

### Fix

Add one admin-only database function, `preview_case_commission_split(case_id)`, that runs the **same classification and the same rate resolvers** the payout engine uses (partner pool, ambassador rate, agent recruitment split, agent self-referral, student referral reward) and returns the finished lines. The panel then only renders what the server returns — no commission math in the browser, so preview and payout cannot drift again.

The panel gains:
- a line naming the referrer with their role (Partner / Ambassador / Agent / Student), and where the rate came from (custom rate for this account vs. global default);
- for partners recruited by an agent, the agent line labelled as recruitment share on top of the partner's amount;
- the existing referral-discount, team, and platform-revenue lines unchanged.

No change to how commissions are actually calculated or paid.

## Part 2 — German payment confirmations: course + accommodation required, insurance optional

- **Enrollment gate:** insurance is removed from the blocking checks. Language course and accommodation still block "mark as paid" until confirmed. Insurance can be confirmed later, whenever the student pays it after arriving.
- **Finance tab UI:** each German item gets a clear confirmed state — a green confirmed chip with who confirmed it and when, replacing the button once done. Insurance is labelled "Optional — paid after arrival in Germany" and never counts against readiness.
- **Readiness line:** a small "Required German payments: 1 of 2 confirmed" summary above the items, so it is obvious what still blocks enrollment.
- The submission checklist item stops reporting the case as unverified just because insurance is pending.

## Technical notes

- New migration: `preview_case_commission_split(p_case_id uuid)` — SECURITY DEFINER, admin-gated, granted to `authenticated`; internally calls `partner_base_pool`, `get_effective_agent_split` (under the existing internal GUC), `get_effective_agent_self_referral`, `get_student_referral_reward`, mirroring `record_case_commission`'s branch order (ambassador → partner → agent self → student).
- Same migration: `assert_case_ready_for_enrollment` drops the `insurance` blocking branch (the item is still returned in `items` with its confirmed flag).
- `src/pages/admin/AdminSubmissionsPage.tsx`: `loadSplitPreview` replaced by a single RPC call; the visibility-source filter and the override-only partner lookup are removed. `fetchPartnerVisibilityOverride` stays in use elsewhere.
- `src/components/cases/CaseFinance.tsx`: `germanyVerified` excludes insurance; verification block renders confirmed-by/at, optional badge for insurance, and the required-count summary.
- New i18n keys in `en` + `ar` `dashboard.json` (parity guard).
- Build (`npm run build`) and `npx vitest run` must stay green.
