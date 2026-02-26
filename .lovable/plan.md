
# Tiered Commission System — Single Migration

This is a pure backend change. One SQL migration file, no frontend or edge function changes.

## What This Migration Does

### 1. Creates `commission_tiers` table
Stores the 4 tiers with RLS so only admins can modify rates:

| Students | Percentage | Amount |
|---|---|---|
| 1–5 | 20% | 800₪ |
| 6–15 | 28% | 1,120₪ |
| 16–30 | 38% | 1,520₪ |
| 31+ | 43% | 1,720₪ |

### 2. Creates `get_influencer_tier_commission(uuid)` helper function
- Counts paid cases for this influencer at the moment the trigger fires
- Adds 1 to get the "next student number"
- Looks up the correct tier from `commission_tiers`
- Returns the exact ILS amount (rounded to whole number)

### 3. Replaces `auto_split_payment()` trigger function
- All existing logic is preserved exactly (cancellation, referral rewards, lawyer rewards, translation rewards)
- Only the influencer commission line changes: instead of reading `profiles.commission_amount`, it calls `get_influencer_tier_commission(v_lead.source_id)`
- The result is written to `NEW.influencer_commission` and the rewards row exactly as before

## What Does NOT Change
- No frontend files
- No edge functions
- No RLS policies (existing ones stay)
- No other tables
- The rewards row format is identical — `admin_notes` still contains the case ID string
- The 20-day lock, payout flow, influencer dashboard, admin money tab — all unchanged

## File to Create
`supabase/migrations/20260227000002_tiered_commission_logic.sql`
