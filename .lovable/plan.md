
# Multi-Feature Update: Apply Page Major Field, Influencer Fixes, Funnel, Payout WhatsApp, and Hero Text

## 1. Add "Preferred Major" Field to Apply Page

**Database change:** Add a `preferred_major` column to the `leads` table (text, nullable).

**RPC update:** Update the `insert_lead_from_apply` database function (the 5-parameter companion version) to accept `p_preferred_major text DEFAULT NULL` and store it.

**UI change in `ApplyPage.tsx`:**
- Add a new state variable `preferredMajor`
- In Step 2 (educational background), add a grouped Select dropdown populated from `majorsData` categories and sub-majors
- Show category headers with sub-major options (bilingual AR/EN)
- Pass `p_preferred_major` to the RPC call

## 2. Verify Influencer Referral Link Auto-Attribution

The existing code already handles this correctly:
- Each influencer's unique link is `?ref={userId}` (in `ReferralLink.tsx`)
- `ApplyPage.tsx` checks `?ref=` param, verifies the user has the `influencer` role, and sets `sourceType = 'influencer'` and `sourceId = ref`
- The RPC stores `source_type` and `source_id` on the lead

No changes needed here -- this already works. The lead will be attributed to the influencer automatically.

## 3. Remove "Media" Tab from Influencer Dashboard

**File: `InfluencerDashboardPage.tsx`**
- Remove `'media'` from `TAB_IDS` array
- Remove `media: Image` from `TAB_ICONS`
- Remove the `MediaHub` import and render line
- Keep `MediaHub` component file intact (no deletion) in case it's needed later

## 4. Payout Request Redirects to WhatsApp

**File: `EarningsPanel.tsx`**
- After submitting a payout request (in `submitPayoutRequest`), redirect the user to `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1` using `window.open()`
- Remove the in-app payout request modal entirely, replacing the "Request Payout" button with a direct WhatsApp redirect
- Or keep the modal for confirmation but after submission, open the WhatsApp link

Chosen approach: Keep the confirmation modal, but after successful submission, open the WhatsApp link automatically so the influencer can follow up.

## 5. Update Apply Page Hero Text

**File: `ApplyPage.tsx`**
- Replace the hero title from "Your Dream of Studying in Germany Starts Here" to a more professional, value-driven message
- Update both AR and EN inline fallbacks:
  - EN: "Take the First Step Toward Your Future in Germany" with subtitle "You are not alone -- the Darb team guides you from application to arrival. Share your details and we will reach out shortly."
  - AR: Equivalent professional Arabic translation

## 6. Test Admin Funnel Visualization

The funnel in `FunnelVisualization.tsx` and `AdminOverview.tsx` already:
- Counts leads by `status` field and cases by `case_status` field
- Maps to the 10-stage pipeline: New -> Eligible -> Assigned -> Contacted -> Appointment -> Paid -> Ready to Apply -> Registration Submitted -> Visa Stage -> Settled

This logic is correct and matches the DSOS funnel. No code changes needed -- it already makes sense structurally.

---

## Technical Details

| File | Action |
|------|--------|
| Database migration | Add `preferred_major TEXT` column to `leads` table |
| Database migration | Update `insert_lead_from_apply` RPC (companion version) to accept `p_preferred_major` |
| `src/pages/ApplyPage.tsx` | Add major selector in Step 2, update hero text, pass major to RPC |
| `src/pages/InfluencerDashboardPage.tsx` | Remove `media` tab from tabs array and rendering |
| `src/components/influencer/EarningsPanel.tsx` | Open WhatsApp link after payout request submission |

## Unchanged Files
- `FunnelVisualization.tsx` -- Already correct
- `AdminOverview.tsx` -- Already correct
- `ReferralLink.tsx` -- Already provides unique per-influencer links
- `MediaHub.tsx` -- File kept, just not rendered in influencer dashboard
