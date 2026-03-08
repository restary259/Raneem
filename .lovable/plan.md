
## Commission Settings UI Overhaul

### What the user wants
Remove the **Global Rates** card entirely. The UI should be **per-account only**:
- Select a partner → set their commission amount + choose their **case visibility** (All Cases / Apply+Contact auto-generated only / Referral cases only)
- Select a team member → set their commission amount
- No global fallback rates shown in the UI (the DB defaults remain as a backend safety net)

### Current state
`CommissionSettingsPanel.tsx` has:
1. **Global Commission Rates** card (partner_commission_rate + team_member_commission_rate inputs) → **REMOVE**
2. **Partner Dashboard Visibility** global switch → **REMOVE** (replaced by per-account setting)
3. **Save Global Settings** button → **REMOVE**
4. **Per-Partner Overrides** card — keep + enhance with new 3-option visibility selector
5. **Per-Team-Member Overrides** card — keep as-is

### New visibility options for partners (3 choices, not 2)
Currently the `partner_commission_overrides.show_all_cases` is a nullable boolean:
- `null` = global default
- `true` = all cases
- `false` = apply/contact only

User wants **3 explicit options**:
1. **All Cases** — sees everything
2. **Apply / Contact page only** — only auto-generated leads from apply/contact forms
3. **Referral cases only** — only cases that came from referrals

Since the DB has a boolean `show_all_cases` column (null/true/false), we can re-map:
- `true` → All Cases
- `false` → Apply + Contact auto-generated
- `null` → Referral cases only (new semantic for null)

BUT — a cleaner approach that doesn't change DB schema: use `null` as "Apply+Contact only" (existing behavior) and add a separate `show_referral_only` concept... however since we can't add a column without migration, we should reuse the existing 3-state nullable boolean and just **relabel** the options clearly in the UI. The semantic mapping becomes:
- `true` → "All cases"
- `false` → "Apply / Contact form cases only"  
- `null` → "Referral cases only"

This requires NO schema change.

### Files to change — 1 file

**`src/components/admin/CommissionSettingsPanel.tsx`** — full rewrite of the return JSX:

#### Remove:
- `saveGlobalSettings` function (keep it in state to not break anything, but remove the UI)
- The Global Rates `<Card>` (lines 197–275)
- The Partner Dashboard Visibility `<Card>` (lines 277–299)
- The global Save button (lines 301–305)

#### Keep + Improve:
- `fetchData`, all state, `addPartnerOverride`, `addTeamOverride`, `deletePartnerOverride`, `deleteTeamOverride`
- Per-partner overrides card — update the 3 visibility pills:
  - Option 1: value=`"true"` → label "All Cases" → desc "Sees all cases in the system"
  - Option 2: value=`"false"` → label "Apply / Contact Only" → desc "Only auto-generated leads from Apply and Contact pages"
  - Option 3: value=`"null"` → label "Referral Cases Only" → desc "Only cases that came through referral links"
- Update the badge display on existing overrides to match the 3 new labels
- Per-team-member overrides card — no changes needed

#### New layout structure:
```text
[Page]
  ├─ Section: Partner Commission
  │    ├─ Existing override rows (partner name | ₪amount | visibility badge | delete)
  │    └─ Add/Update form:
  │         ├─ Select Partner dropdown
  │         ├─ ₪ Amount input
  │         ├─ Notes input  
  │         └─ Case Visibility: [All Cases] [Apply/Contact Only] [Referral Only]
  │              └─ Save button
  │
  └─ Section: Team Member Commission
       ├─ Existing override rows (name | ₪amount | delete)
       └─ Add/Update form:
            ├─ Select Team Member dropdown
            ├─ ₪ Amount input
            ├─ Notes input
            └─ Save button
```

### No DB changes needed
The `show_all_cases` nullable boolean in `partner_commission_overrides` supports 3 states (true/false/null) which maps perfectly to the 3 visibility options. No migration required.

### What changes in `CommissionSettingsPanel.tsx`
1. Delete `saveGlobalSettings` function
2. Delete `settings` state and `PlatformSettings` interface (no longer needed)
3. Remove `partner_commission_rate` / `team_member_commission_rate` references
4. Remove the 3 cards (Global Rates, Partner Dashboard Visibility, Save Global button)
5. Update the 3 visibility pill labels to: "All Cases" / "Apply / Contact Only" / "Referral Cases Only"
6. Update the badge display to match the same 3 labels
7. Add a descriptive header explaining this is per-account configuration
