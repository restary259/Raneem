

## Public Apply Funnel Page + Influencer Referral Link Update

### What We're Building

A standalone, high-converting public landing page at `/apply` that influencers can share via Instagram bio/stories. Students click, fill a branded multi-step form (no login required), and a new lead appears instantly in the Admin Dashboard.

---

### 1. New Page: `/apply`

**Route**: Add `/apply` to `App.tsx` routes (public, no auth).

**Design**:
- Standalone page -- NO Header, NO Footer, NO BottomNav, NO ChatWidget
- Minimal branded top bar: just the Darb logo
- Ghost White background (#F8FAFC)
- Mobile-first, Arabic RTL, IBM Plex Sans Arabic
- No horizontal scroll, vertical card layout

**Page Structure**:

**Section A -- Hero (Trust)**
- Headline: "ابدأ رحلتك للدراسة في ألمانيا" with German flag emoji
- Subtext: "املأ البيانات وسنتواصل معك عبر واتساب خلال وقت قصير"
- Clean, centered, large Arabic font

**Section B -- Multi-Step Form (3 steps with progress bar)**

Step 1 (Personal Info):
- Full Name (text)
- Phone / WhatsApp (text)

Step 2 (Background):
- City (inside 48) (text)
- Education Level (select: ثانوية / بكالوريوس / ماجستير)
- German Level (select: لا يوجد / A1 / A2 / B1 / B2 / C1)

Step 3 (Preferences):
- Budget Range (select: ranges)
- Preferred City in Germany (select: Berlin / Munich / Hamburg / Frankfurt / Other)
- Need Accommodation? (Yes/No toggle)

Each step has Next/Back buttons. Final step has "أرسل بياناتي" CTA.

Progress bar at top of form card showing Step 1/2/3.

**Section C -- Trust Elements**
- Three small badges below form: "استشارة مجانية" / "مدارس معتمدة" / "متابعة حتى التسجيل"

**Section D -- Confirmation Screen**
- After submit, replace form with: "تم استلام بياناتك" with checkmark
- Subtext: "سيتم التواصل معك عبر واتساب قريبا"
- No redirect, no reload

**Floating WhatsApp Button**:
- Bottom-right corner, always visible
- Links to Darb WhatsApp: `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1`
- Label tooltip: "راسلنا مباشرة"

---

### 2. Backend Logic

**Referral Detection**:
- Read `?ref=USER_ID` from URL query params
- If `ref` param exists, look up `user_roles` to verify the user is an influencer
- If valid: set `source_type = 'influencer'` and `source_id = influencer_id`
- If no ref or invalid: set `source_type = 'organic'`, `source_id = null`

**Submission**:
- Use existing `upsert_lead_from_contact` RPC pattern but we need a new RPC function `insert_lead_from_apply` that accepts all the apply-specific fields (city, education_level, german_level, budget_range, preferred_city, accommodation, source_type, source_id)
- Duplicate prevention by phone number (same pattern -- update if exists, insert if not)
- Set `status = 'new'`, `eligibility_score = 0`

**Database**: Create a new `insert_lead_from_apply` SECURITY DEFINER function that handles the upsert with all fields + source tracking. Add an RLS-bypassing function so anonymous users can submit without auth.

---

### 3. Influencer Referral Link Update

Update `ReferralLink.tsx` to point to `/apply?ref=USER_ID` instead of `/student-auth?ref=USER_ID`.

The influencer's link becomes:
`darbstudy.com/apply?ref=5bd865af-...`

---

### 4. English Translations

Add English translations for all apply page strings in `public/locales/en/landing.json` and Arabic in `public/locales/ar/landing.json` under an `apply` key.

---

### Technical File Summary

| Action | File | Changes |
|---|---|---|
| Create | `src/pages/ApplyPage.tsx` | Full multi-step funnel page component |
| Edit | `src/App.tsx` | Add `/apply` route |
| Edit | `src/components/influencer/ReferralLink.tsx` | Change link from `/student-auth?ref=` to `/apply?ref=` |
| Migration | Database | Create `insert_lead_from_apply` RPC function (SECURITY DEFINER) |
| Edit | `public/locales/ar/landing.json` | Add `apply` translation keys |
| Edit | `public/locales/en/landing.json` | Add `apply` translation keys |

### Implementation Order
1. Database migration (new RPC function)
2. Create ApplyPage.tsx with multi-step form
3. Add route in App.tsx
4. Update ReferralLink.tsx
5. Add translations

