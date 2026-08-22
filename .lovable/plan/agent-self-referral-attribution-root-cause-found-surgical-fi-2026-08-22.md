# Agent self-referral attribution — root cause found, surgical fix

## Confirmed root cause (proven, not assumed)

The frontend and the database are both correct. The **deployed** `create-case-from-apply`
edge function is **older than the repository source** and does not recognise the `agent`
role when resolving a referral code.

Evidence gathered this session:

1. Live probe against the deployed endpoint with `ref_code: "agent-20be"`
   (agent `df1d18f4…`) created case `667176d2…` with `partner_id = NULL`,
   `source_attribution_method = NULL`.
2. The **same request** created a lead row with `source_id = df1d18f4…`,
   `source_attribution_method = 'link'`. The lead mirror calls
   `insert_lead_from_apply` → `resolve_referral_code`, which resolves the agent
   correctly. So the referral code **did** reach the server and the DB resolver
   **does** support agents.
3. `resolve_referral_code` / `check_referral_code` grants are intact
   (`anon`, `authenticated`, `service_role` all have EXECUTE).
4. Partner-link submissions from the same afternoon (`bd420f9a…`) were attributed
   with method `link`; only agent-code submissions lost attribution.
5. Repo source line 227 already includes `"agent"` in the role lookup; last commit
   touching the file is 2026-08-15, and the running deployment predates it.

So: code is right, deployment is stale. No frontend change is required.

## Files that will change

- **None in `src/`.** `ApplyForm.tsx`, `referral.ts`, `ApplyPage.tsx` stay untouched —
  the audit disproved the suspected client-side diagnosis (`shouldKeepReferralCode`
  already protects the persisted code, and the code demonstrably reaches the server).

## Steps

1. **Redeploy** `supabase/functions/create-case-from-apply` from the current repo source.
2. **Re-probe** the live endpoint with the agent code and confirm the new case row has
   `partner_id = df1d18f4…` and `source_attribution_method = 'link'`.
3. **Delete the two throwaway probe rows** (case + lead named `ZZ Attribution Probe`).
4. **Targeted backfill** of the two confirmed lost cases only — `agent referral link`
   (19:23) and `Luufyy` (19:52). Both have a matching lead row created in the same
   server call with `source_id = df1d18f4…` and `source_attribution_method = 'link'`,
   which is the trustworthy evidence linking them to the agent. The backfill uses the
   existing additive `backfill_case_attribution` RPC (never overwrites an existing
   attribution), scoped by explicit case id — no name matching, no bulk update.
   `test 11` already carries correct attribution and will not be touched.
5. **Dashboard verification**: confirm both recovered cases render under the agent's
   "Your own referrals" tab (`AgentStudentsPage` filters `cases.partner_id` in
   [recruits…, own uid], so correct `partner_id` is sufficient once RLS's
   agent self-referral SELECT policy applies — that policy is already live).
6. **Regression check**: partner link, ambassador link, and bare `/apply` remain
   unchanged — verified by probing the deployed endpoint after redeploy.

## Tests

No behavioural source change means no new unit test is meaningful for the fix itself.
Existing `src/lib/referral.test.ts` already encodes the intended persistence behaviour
and stays as-is. Validation is: `npm run build`, `npx vitest run`, plus the live probe
above (the real regression surface here is the deployment, not the bundle).

## Risks and how they are contained

- *Redeploy carrying unintended changes*: the deployed file is the committed source
  already reviewed at commit `c674b590`; nothing is edited before deploy.
- *Backfill touching the wrong rows*: two explicit case ids, additive RPC, verified
  against the lead rows written by the same request.
- *Nothing in commissions, RLS, partner/ambassador behaviour, or schemas changes.*
