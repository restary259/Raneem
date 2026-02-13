

## Contact Form to Leads + Home Page English Translations

### Part 1: Redirect Contact Form to Leads Table

**Current behavior**: Form submits to `send-email` edge function, which saves to `contact_submissions` and optionally emails.

**New behavior**: Form inserts directly into the `leads` table from the frontend. No edge function call. No email.

**Database Changes Required**

The `leads` table is missing columns that the contact form collects. We need to add:

| New Column | Type | Purpose |
|---|---|---|
| `email` | text, nullable | From form email field |
| `service_requested` | text, nullable | From form service dropdown |
| `notes` | text, nullable | From form message field |
| `study_destination` | text, nullable | From form destination dropdown |

We also need an RLS policy allowing anonymous inserts (public-facing form, no auth required). This will use a restrictive approach -- only INSERT, no SELECT/UPDATE/DELETE for anon.

**Field Mapping**

| Form Field | Leads Column |
|---|---|
| `name` | `full_name` |
| `email` | `email` (new) |
| `whatsapp` | `phone` |
| `studyDestination` | `study_destination` (new) + `preferred_city` |
| `service` | `service_requested` (new) |
| `message` | `notes` (new) |
| -- | `status` = 'new' |
| -- | `eligibility_score` = 0 |
| -- | `source_type` = 'contact_form' |

**Duplicate Prevention**: Before inserting, query by phone number. If a match exists, update `created_at` instead of creating a duplicate. Since anon users can't SELECT the leads table, this check will be done via a database function (`upsert_lead_from_contact`) called through `.rpc()`.

**Code Changes (Contact.tsx)**
- Remove the `supabase.functions.invoke('send-email', ...)` call
- Replace with `supabase.rpc('upsert_lead_from_contact', { ... })` 
- Keep honeypot check on the client side (silently succeed if filled)
- Keep all form fields, validation, design, layout, and success/error messages exactly as they are
- Disable submit button while pending (already done)

**Admin Dashboard**
- `LeadsManagement.tsx` already shows all leads sorted by newest. New contact form leads will appear with `source_type = 'contact_form'` and `status = 'new'`. No changes needed -- they appear instantly on next query/refetch.

---

### Part 2: Home Page English Translations

Three components on the home page have hardcoded Arabic text with no i18n:

**2.1 AboutCustom.tsx** -- Stats section
- Hardcoded: "ارقامنا تتحدث", "الشفافية والنجاح...", "طالب راض", "شريك", "دول حول العالم", "نسبة النجاح"
- Fix: Use `t()` keys from landing namespace

**2.2 StudentJourney.tsx** -- Journey steps
- Hardcoded: "رحلتك نحو الدراسة في الخارج", step titles and descriptions
- Fix: Use `t()` keys from landing namespace

**2.3 PartnersMarquee.tsx** -- Section heading
- Hardcoded: "أفضل الجامعات العالمية"
- Fix: Use `t()` key from landing namespace

**Translation keys to add to `public/locales/en/landing.json`**:

```json
"aboutStats": {
  "title": "Our Numbers Speak",
  "subtitle": "Transparency and success are the foundation of our work, and these numbers reflect our students' trust in us.",
  "satisfiedStudents": "Satisfied Students",
  "partners": "Partners",
  "countries": "Countries Worldwide",
  "successRate": "Success Rate"
},
"journey": {
  "title": "Your Journey to Studying Abroad",
  "subtitle": "We're with you step by step, from the idea to your first day of class.",
  "steps": [
    { "title": "Consultation & Assessment", "description": "Your journey begins with a free consultation to understand your goals and evaluate your profile." },
    { "title": "Document Preparation & Applications", "description": "We help you prepare all documents and submit your applications to universities and embassies." },
    { "title": "Travel Preparation", "description": "After receiving your acceptance and visa, we help you book housing and prepare for travel." },
    { "title": "Post-Arrival Support", "description": "We welcome you and provide the support you need to settle in and start your studies comfortably." }
  ]
},
"partnersMarquee": { "title": "Top Global Universities" }
```

**Same keys added to `public/locales/ar/landing.json`** with the existing Arabic text, so both components use `t()` consistently.

**Component updates**: Replace all hardcoded strings with `t('key')` calls.

---

### Technical File Summary

| Action | File | Changes |
|---|---|---|
| Migration | Database | Add `email`, `service_requested`, `notes`, `study_destination` to `leads`; create `upsert_lead_from_contact` RPC function; add anon insert policy |
| Edit | `src/components/landing/Contact.tsx` | Replace edge function call with `supabase.rpc('upsert_lead_from_contact', ...)` |
| Edit | `src/components/landing/AboutCustom.tsx` | Replace hardcoded Arabic with `t()` calls |
| Edit | `src/components/landing/StudentJourney.tsx` | Replace hardcoded Arabic with `t()` calls |
| Edit | `src/components/landing/PartnersMarquee.tsx` | Replace hardcoded Arabic with `t()` call |
| Edit | `public/locales/en/landing.json` | Add `aboutStats`, `journey`, `partnersMarquee` keys |
| Edit | `public/locales/ar/landing.json` | Add same keys with Arabic text |

### Implementation Order
1. Database migration (new columns + RPC function + RLS)
2. Contact.tsx backend swap
3. Home page i18n (all three components + both locale files)

