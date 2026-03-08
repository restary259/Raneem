
## Two changes to AdminSubmissionsPage

### Problem 1: "Open Full Case File" navigates to `/team/cases/:id`
Admins are navigated to the team member case detail page (`CaseDetailPage`), which uses team-role RLS and is designed for lawyers. The correct destination for admin is `/admin/pipeline` with the case pre-opened in the sheet.

**Fix strategy:** Two-part change:
1. In `AdminSubmissionsPage.tsx` — change the navigate call from `/team/cases/${selected.id}` to `/admin/pipeline?case=${selected.id}`.
2. In `AdminPipelinePage.tsx` — on mount, read `?case=<id>` from URL search params and auto-open that case in the Sheet (reuse the existing `openCase()` function).

---

### Problem 2: No copy buttons on fields in the submissions detail dialog
The dialog currently has fields like phone, city, name, email (from extra_data) etc. with no copy-to-clipboard ability.

**Fix strategy:** Add a small inline copy button (using the existing `CopyButton` component from `src/components/common/CopyButton.tsx`) next to every field value that contains copyable text. Apply it to:
- Phone
- City  
- Education
- Passport
- Submitted date
- Service fee
- All `extra_data` field values (First Name, Last Name, Date of Birth, Gender, Student Email, Student Phone etc. — visible in the screenshot)

The `CopyButton` component already exists and handles clipboard API + fallback. Just import and place it inline next to each `<p className="font-medium">` value.

---

### Files to change: 2

**`src/pages/admin/AdminSubmissionsPage.tsx`**
- Line ~484: Change `navigate(`/team/cases/${selected.id}`)` → `navigate(`/admin/pipeline?case=${selected.id}`)`
- Lines ~322–443: Wrap each field `<div>` to show value + `<CopyButton value={...} />` inline using `flex items-center gap-1`
- Import `CopyButton` from `@/components/common/CopyButton`

**`src/pages/admin/AdminPipelinePage.tsx`**
- Add `useSearchParams` and `useEffect` after data loads — if `?case=<id>` is present, find that case and call `openCase()` on it
- This makes the URL `/admin/pipeline?case=abc123` auto-open the correct case sheet

The `CopyButton` component already has:
- Click-to-copy with `navigator.clipboard` + execCommand fallback
- Check icon for 2s after copy
- `e.stopPropagation()` so it doesn't bubble up and close things

No DB changes, no migration needed.
