

## Apply Page Success Animation, Payouts Identity, 20-Day Timer, and Influencer Auto-Tag

This plan addresses four interconnected issues: the apply page lacks a post-submission CTA, the admin payouts view doesn't show who requested money, the 20-day payout timer needs to be visible properly, and leads from influencer links need to auto-display the influencer name.

---

### 1. Apply Page -- Success Animation and "Explore Website" Button

**Current**: After submission, users see a static checkmark and text with no way to navigate further.

**Changes to `src/pages/ApplyPage.tsx`**:
- Add a confetti-style CSS animation (scaling circles or a pulse ring effect) around the checkmark icon on the success screen
- Add a styled "Explore Our Website" button that links to `/` (home page)
- Add a secondary text line encouraging the user to browse services while they wait
- The animation will use Tailwind keyframes already defined in the project (scale-in, fade-in) plus a new pulse-ring animation

**Translations**: Add `apply.exploreWebsite` and `apply.whileYouWait` keys to `en/landing.json` and `ar/landing.json`.

### 2. Admin Payouts -- Show Requester Name

**Current**: The PayoutsManagement component queries `rewards` with `select('*')`, which only contains `user_id` -- no name is displayed. Admin cannot identify who requested the payout.

**Changes to `src/components/admin/PayoutsManagement.tsx`**:
- Change the rewards query to join with profiles: `select('*, profiles!rewards_user_id_fkey(full_name, email)')` -- but since there's no FK, we'll use a two-step approach:
  1. Fetch rewards
  2. Fetch all profiles for the reward `user_id` values
  3. Map names onto rewards
- Add a "Requester" column to both desktop table and mobile cards showing the influencer/student name
- Show email as a secondary line for additional identification

### 3. 20-Day Timer on Cases (Visible to Admin)

**Current**: The 20-day timer logic exists in the influencer's `EarningsPanel` but is NOT visible in the admin's `CasesManagement` when a case status changes to "paid".

**Changes to `src/components/admin/CasesManagement.tsx`**:
- When a case has `case_status === 'paid'` and `paid_at` is set, calculate days remaining (20 - days since `paid_at`)
- Display a timer badge next to the student name on paid cases: e.g., "14 days remaining" with a Clock icon
- When the timer reaches 0, show "Ready for payout" in green

### 4. Auto-Tag Influencer Name on Leads from Referral Links

**Current**: When a lead submits via `/apply?ref=INFLUENCER_UUID`, the `source_id` is saved but no influencer name is displayed in the admin Leads view.

**Changes to `src/components/admin/LeadsManagement.tsx`**:
- The admin dashboard already fetches `influencers` (profiles with influencer role). We need to pass influencers list to `LeadsManagement`.
- In the lead card, when `source_type === 'influencer'` and `source_id` exists, look up the influencer name from the profiles/influencers list and display it as a badge: "via [Influencer Name]"

**Changes to `src/pages/AdminDashboardPage.tsx`**:
- Pass the `influencers` array to `LeadsManagement` as a new prop

### 5. Reward Creation Trigger on "Paid" Status

**Current**: In `CasesManagement.tsx`, when a case is marked "paid", commissions are created in the `commissions` table but NO reward record is created for the influencer in the `rewards` table. The influencer's 20-day timer and payout request depend on rewards being created.

**Fix in `src/components/admin/CasesManagement.tsx`**:
- When `case_status` changes to `paid`, check if the lead has `source_type === 'influencer'` and `source_id`
- If yes, create a reward record in the `rewards` table:
  - `user_id`: the influencer's UUID (from `source_id`)
  - `amount`: the `influencer_commission` value
  - `status`: 'pending'
  - `created_at`: now (this is when the 20-day timer starts)
- This connects the case payment to the influencer's earnings panel and payout flow

---

### Technical File Summary

| Action | File | Changes |
|--------|------|---------|
| Edit | `src/pages/ApplyPage.tsx` | Success animation with pulse ring, "Explore Website" CTA button |
| Edit | `src/components/admin/PayoutsManagement.tsx` | Join rewards with profiles to show requester name/email |
| Edit | `src/components/admin/CasesManagement.tsx` | 20-day timer badge on paid cases + auto-create influencer reward |
| Edit | `src/components/admin/LeadsManagement.tsx` | Show influencer name badge on referral leads |
| Edit | `src/pages/AdminDashboardPage.tsx` | Pass influencers prop to LeadsManagement |
| Edit | `public/locales/en/landing.json` | Add apply success CTA translations |
| Edit | `public/locales/ar/landing.json` | Add apply success CTA translations |

### Implementation Order
1. Apply page success screen (animation + CTA)
2. Payouts requester identity
3. Cases 20-day timer display + reward auto-creation
4. Leads influencer name auto-tag
5. End-to-end testing of full flow

