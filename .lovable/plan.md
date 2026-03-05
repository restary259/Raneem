## Audit Findings      {

  "timestamp": 1772677772918,

  "error_type": "RUNTIME_ERROR",

  "filename": "supabase/functions/create-team-member/index.ts",

  "lineno": 0,

  "colno": 0,

  "stack": "not_applicable",

  "has_blank_screen": true

}

### Issue 1 — Create Team Member field name mismatch (confirmed bug)

`AdminTeamPage.tsx` line 82 sends `{ fullName: form.fullName, ... }` but `create-team-member/index.ts` line 59 destructures `{ full_name }`. The field name mismatch means `full_name` is always `undefined`, triggering the 400 validation error `"Email, full_name, and role required"`.

**Fix:** Change `AdminTeamPage.tsx` body to send `full_name: form.fullName`.

### Issue 2 — Create Influencer role validation rejects correct values

`create-team-member/index.ts` only allows `["team_member", "social_media_partner"]` (line 83) but `InfluencerManagement.tsx` sends `role: "influencer"` or `role: "lawyer"`. These are invalid and cause a 400 error.

However, `create-influencer/index.ts` exists specifically for influencers with hardcoded role `influencer`. The `InfluencerManagement.tsx` incorrectly calls `create-team-member` for all roles.

**Fix:** In `InfluencerManagement.tsx`, route to `create-influencer` when role is `influencer`, and `create-team-member` when role is `team_member`/`social_media_partner`. Also add `influencer` to `create-team-member`'s allowed roles OR use the dedicated function.

### Issue 3 — Login page already looks decent

The `StudentAuthPage.tsx` login page is already clean and minimal. No major overhaul needed — minor polish only (remove extra padding/clutter if any).

### Issue 4 — Programs & Accommodations show plain list rows

`AdminProgramsPage.tsx` renders items as simple `<div>` rows with minimal text. Need to upgrade to proper card grid layout with icons, badges, and structured info.

---

## Plan

### File 1: `src/pages/admin/AdminTeamPage.tsx`

- Fix field name: `fullName` → `full_name` in the fetch body

### File 2: `src/components/admin/InfluencerManagement.tsx`

- When `role === 'influencer'`, call `create-influencer` endpoint
- When `role === 'team_member'` or `'social_media_partner'`, call `create-team-member`
- Ensure `role: 'lawyer'` is mapped to `team_member` (the valid DB role)

### File 3: `supabase/functions/create-team-member/index.ts`

- Also accept `influencer` in the allowed roles array as a fallback safety net

### File 4: `src/pages/admin/AdminProgramsPage.tsx`

- Replace the flat list rows with proper card grid
- Program card: icon for type, name (AR/EN), type badge, price chip, duration, active status, actions
- Accommodation card: home icon, name, price badge, description, active status, actions

### File 5: `src/pages/StudentAuthPage.tsx` (minor)

- The login page is already minimal and clean. Only tweak: ensure the change-password dialog uses both Arabic/English based on `i18n.language`, and the overall layout stays polished.

---

## Step-by-step

```text
1. AdminTeamPage.tsx       → fix "fullName" → "full_name" in POST body
2. InfluencerManagement.tsx → route influencer role to create-influencer endpoint  
3. create-team-member fn   → expand allowed roles to include "influencer" for safety
4. AdminProgramsPage.tsx   → replace list rows with styled card grid (Program + Accommodation cards)
5. StudentAuthPage.tsx     → minor polish: bilingual change-password dialog
```

### Program Card Design

```text
┌─────────────────────────────────────┐
│  [icon]  Program Name (EN)          │
│          Program Name (AR)          │
│  [Language School badge]            │
│  ─────────────────────────          │
│  💰 4,500 ILS   ⏱ 6 months          │
│  📝 Description text...             │
│                                     │
│  [Active ●]  [Pause] [Delete]       │
└─────────────────────────────────────┘
```

### Accommodation Card Design

```text
┌─────────────────────────────────────┐
│  🏠  Accommodation Name (EN)        │
│      Accommodation Name (AR)        │
│  ─────────────────────────          │
│  💰 2,800 ILS/month                 │
│  📝 Description text...             │
│                                     │
│  [Active ●]  [Pause] [Delete]       │
└─────────────────────────────────────┘
```