
## Add "Completed Submissions" Subtab to الطلبات المقدمة

### What needs to happen
The page currently fetches only `status = 'submitted'` cases. When admin marks a case as enrolled (via the password-gated flow), the `admin-mark-paid` edge function changes the status to `enrollment_paid`. Those cases disappear from the list. The user wants them visible in a second subtab called "Completed" / "مكتملة".

### Changes required

#### 1. `src/pages/admin/AdminSubmissionsPage.tsx`
- Add a `activeTab` state: `'pending' | 'completed'`
- Add a second fetch function `fetchCompletedCases()` that queries `status = 'enrollment_paid'` (same shape as the current fetch)
- Add a `completedCases` state array
- Render two subtab buttons at the top (using the existing `Tabs`/`TabsList`/`TabsTrigger` from `@/components/ui/tabs` or simple styled buttons)
- When `activeTab === 'pending'` → show the existing list (cases)
- When `activeTab === 'completed'` → show `completedCases` list, same card row design, but the dialog won't have the "Mark as Enrolled" button (read-only). Instead show a green "✅ Enrolled" badge. Add an enrollment date row.
- On load, fetch both in parallel (`Promise.all`)
- After `markEnrolled` succeeds, refetch both lists

#### 2. Translation files (`ar/dashboard.json` + `en/dashboard.json`)
Add inside the `submissions` block:
```json
"tabPending": "قيد المراجعة",        // EN: "Pending Review"
"tabCompleted": "مكتملة",            // EN: "Completed"
"enrolledOn": "تاريخ التسجيل",       // EN: "Enrolled On"
"emptyCompleted": "لا توجد حالات مكتملة بعد"  // EN: "No completed cases yet"
```

### Implementation detail

The completed cases dialog will be simplified — no "Mark as Enrolled" button, no split panel or password gate. It just shows all the same info fields plus an "Enrolled On" date from `submission.enrollment_paid_at`, and the "Open Full Case" button still works.

The two tabs will look like:
```
[ قيد المراجعة (N) ]  [ مكتملة (M) ]
```
with a count badge on each.

### Files to change: 3
1. `src/pages/admin/AdminSubmissionsPage.tsx` — add tab state, second fetch, split list rendering
2. `public/locales/ar/dashboard.json` — add 4 new keys inside `submissions`
3. `public/locales/en/dashboard.json` — add 4 new keys inside `submissions`
