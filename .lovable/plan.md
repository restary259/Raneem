
## Problem: Table Column Widths Are Unbalanced

The case list table in `PartnerOverviewPage.tsx` uses a plain `<table>` with no column width constraints. Each column sizes itself by content, causing:
- **Name** column: too wide (takes all available space)
- **Major (التخصص)** column: tiny — most rows show "—" so it collapses
- **Status** column: ok but can shift
- **Commission (العمولة)** column: the "في الانتظار" text with clock icon wraps or truncates
- **Date** column: inconsistent width

### Fix: Add explicit `w-*` classes to `<th>` and `<td>` elements

Target widths for 5-column table:

```text
Name        → w-[28%]  (widest, has full names)
Major       → w-[15%]  (often "—", keep compact but stable)
Status      → w-[18%]  (badge fits)
Commission  → w-[22%]  (enough for "في الانتظار" with icon)
Date        → w-[17%]  (fixed date string)
```

Also fix the `numeric-safety-v1` violation on line 294:
- `isAr ? "ar-SA" : "en-GB"` → always `"en-US"` (prevents Arabic-Indic digits ٢٠٢٦/٣/٨)

### Files to change
| File | Change |
|------|--------|
| `src/pages/partner/PartnerOverviewPage.tsx` | Add `w-[X%]` to all 5 `<th>` tags; add matching `w-[X%]` or `max-w-*` + `truncate` to `<td>` tags; fix date locale to `"en-US"` |

Single file, surgical. No DB changes.
