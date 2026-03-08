
## What to change and why

**The core ask**: Everywhere the student profile shows "University" as a field label (and the underlying column is `university_name`), rename it to **"Language School"**. Also ensure the **student-facing profile form** (`StudentProfile.tsx`) is fully aligned with the admin sheet so both sides read/write the same fields with the same labels.

---

### Current state

| Location | Field label shown | DB column |
|---|---|---|
| Admin sheet — view mode | `t("admin.students.fieldUniversity")` → **"University"** | `university_name` |
| Admin sheet — edit mode | same key | `university_name` |
| Student dashboard — view/edit | **"Language School"** (hardcoded in section header) but the `<Input>` still saves to `university_name` ✅ | `university_name` |
| EN locale `admin.students.fieldUniversity` (line 682) | `"University"` | — |
| EN locale `team.students.fieldUniversity` (line 1226) | `"University"` | — |
| AR locale `admin.students.fieldUniversity` (line 682) | `"الجامعة"` | — |
| AR locale `team.students.fieldUniversity` (line 1255) | `"الجامعة"` | — |

**DB column name stays `university_name`** — no migration needed; only labels change.

---

### Alignment gap between admin sheet and student dashboard

**Admin sheet shows** (view mode): email, phone, city, gender, DOB, nationality, address/country, **language school**, intake month, passport no., passport expiry, emergency contact name/phone, arrival date, eye color, changed legal name, criminal record, dual citizenship, notes, timestamps.

**Student `StudentProfile.tsx` shows/edits**: phone, DOB, gender, city of birth, home address, address in Germany (`german_address`), emergency contact, arrival date — then a "Language School & Application" sub-section with **language school** + intake month.

**Missing from student form** (fields admin can see but student can't view/edit):
- Eye color — per memory spec, this is read-only for students (identity data collected by agency). Should be shown as read-only with a lock icon.
- The existing field already works; no column issue.

**Student form has `german_address`** but admin sheet does NOT — the admin's `country` field stores "Address / Country". These are two different columns: `profiles.country` vs a `german_address` column. Need to verify `german_address` exists in the DB schema. Looking at `supabase/types.ts` — there is no `german_address` column in `profiles`. The student profile saves `german_address` but the column doesn't exist in the types file — this is a `(supabase as any)` cast that silently fails. This is a pre-existing issue; I will note it but not add a migration (the user only asked about language school rename + alignment).

---

### Files to change — 4 files

#### 1. `public/locales/en/dashboard.json` — 2 occurrences
- Line 682: `"fieldUniversity": "University"` → `"fieldUniversity": "Language School"`
- Line 1226: `"fieldUniversity": "University"` → `"fieldUniversity": "Language School"`

#### 2. `public/locales/ar/dashboard.json` — 2 occurrences  
- Line 682: `"fieldUniversity": "الجامعة"` → `"fieldUniversity": "معهد اللغة"`
- Line 1255: `"fieldUniversity": "الجامعة"` → `"fieldUniversity": "معهد اللغة"`

#### 3. `src/pages/admin/AdminStudentsPage.tsx` — 2 occurrences
The icon next to the university field in view mode uses `<GraduationCap>` (line 900). Change icon to `<Building2>` (more appropriate for a language school). Also update the inline hardcoded Arabic strings `"العنوان / الدولة"` used as label for the university edit field in the edit form (line 774 — this is just the Address/Country row, not university; university uses the i18n key so it auto-updates). No inline string changes needed for university — the key already drives both modes.
- Import `Building2` from lucide-react (already used in the codebase)
- Line 900: swap icon from `<GraduationCap>` to `<Building2>` for the language school row

#### 4. `src/components/dashboard/StudentProfile.tsx` — alignment additions
Currently missing fields that are visible on the admin sheet but hidden from the student:
- **Eye color** — shown read-only with a lock icon (per memory: identity data is read-only for students)
- **Passport number** — shown read-only with a lock icon (identity data collected by agency)
- **Nationality** — shown read-only with a lock icon

These appear in a new "Identity Information (Read-only)" sub-section so the student can see what the agency has on file, but cannot modify them.

Also fix the section label "Language School & Application" — it already says "Language School" so no change needed there.

The `profile` type (`src/types/profile.ts`) already has `eye_color` — it does NOT have `passport_number` or `nationality`. Need to check what's on the Profile type...

Looking at `src/types/profile.ts` — it has `eye_color`, `has_changed_legal_name`, etc. but does NOT have `passport_number` or `nationality`. These are on `StudentRecord` in AdminStudentsPage but not on the `Profile` type. The student dashboard fetches `select('*')` so the data is there, just the TypeScript type doesn't include it. I'll cast safely with `(profile as any).nationality` etc.

The `Profile` type should be extended to include `nationality` and `passport_number` as optional readonly fields so the student dashboard can display them.

---

### Summary of changes

| File | What changes |
|---|---|
| `public/locales/en/dashboard.json` | `fieldUniversity` → `"Language School"` (2 places) |
| `public/locales/ar/dashboard.json` | `fieldUniversity` → `"معهد اللغة"` (2 places) |
| `src/pages/admin/AdminStudentsPage.tsx` | Change `<GraduationCap>` icon to `<Building2>` for the language school row |
| `src/components/dashboard/StudentProfile.tsx` | Add read-only identity block showing eye color, nationality, passport no. (with lock icons). The editable "Language School" field label is already correct. |
| `src/types/profile.ts` | Add `nationality?: string`, `passport_number?: string` optional fields to `Profile` interface |

**No DB migration needed** — `university_name` column stays as-is, only labels change.
