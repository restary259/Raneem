
## Full Gap Analysis

### Problem 1: Missing translation keys in `admin.ready`
Both `ReadyToApplyTable.tsx` and `StudentCasesManagement.tsx` call these keys that don't exist in either locale file:

| Key used in code | Missing |
|---|---|
| `admin.ready.name` | yes |
| `admin.ready.city` | yes |
| `admin.ready.paymentDate` | yes |
| `admin.ready.count` | yes |
| `admin.ready.exportForSchool` | yes |
| `admin.ready.noResults` | yes |
| `admin.ready.account` | yes |
| `admin.ready.active` | yes |
| `admin.ready.noAccount` | yes |
| `admin.ready.passportType` | yes |
| `admin.ready.educationLevel` | yes |
| `admin.ready.englishLevel` | yes |
| `admin.ready.degreeInterest` | yes |
| `admin.ready.intakeNotes` | yes |

### Problem 2: `PartnerPayoutsPanel` only shows `status=pending`, not `status=approved`

When a reward is in `approved` status (partner pressed "Request Payout" via the `request_payout` RPC), the `PartnerPayoutsPanel` groups it into neither `pending` nor `paid` — it disappears from the UI entirely. The grouping logic:

```typescript
if (r.status === 'pending') byPartner[uid].pending.push(r);
else if (r.status === 'paid') byPartner[uid].paid.push(r);
// 'approved' is silently dropped
```

The admin's "Confirm Payment" button in this panel directly marks `status = 'paid'` (bypassing payout_requests), so it should also accept `approved` rewards. Fix: treat `approved` same as `pending` in the panel.

### Problem 3: Partner Overview shows "Paid All Time / This Month" only from `rewards` table with `status='paid'`

This is actually correct — it reads actual paid amounts. No logic bug here.

### Problem 4: DB has no cases — the flow cannot create test rewards without data

The database is empty (0 cases). The end-to-end payout flow requires at least one case at `enrollment_paid` status to trigger `record_case_commission`. We need to create a test case and run it through to enrollment to generate reward rows.

---

## Plan

### Step 1 — Add all missing `admin.ready.*` keys to EN + AR locale files

**EN additions to `admin.ready` block:**
```json
"name": "Name",
"city": "City",
"paymentDate": "Payment Date",
"count": "{{count}} cases",
"exportForSchool": "Export for School",
"noResults": "No enrolled cases found",
"account": "Account",
"active": "Active",
"noAccount": "No Account",
"passportType": "Passport Type",
"educationLevel": "Education Level",
"englishLevel": "English Level",
"degreeInterest": "Degree Interest",
"intakeNotes": "Intake Notes"
```

**AR additions to `admin.ready` block:**
```json
"name": "الاسم",
"city": "المدينة",
"paymentDate": "تاريخ الدفع",
"count": "{{count}} حالة",
"exportForSchool": "تصدير للمدرسة",
"noResults": "لا توجد حالات مسجلة",
"account": "الحساب",
"active": "نشط",
"noAccount": "لا يوجد حساب",
"passportType": "نوع جواز السفر",
"educationLevel": "المستوى التعليمي",
"englishLevel": "مستوى الإنجليزية",
"degreeInterest": "التخصص المطلوب",
"intakeNotes": "ملاحظات القبول"
```

### Step 2 — Fix `PartnerPayoutsPanel.tsx` to include `approved` rewards in pending list

Change the grouping logic to treat `approved` as `pending`:
```typescript
// BEFORE
if (r.status === 'pending') byPartner[uid].pending.push(r);
else if (r.status === 'paid') byPartner[uid].paid.push(r);

// AFTER
if (r.status === 'pending' || r.status === 'approved') byPartner[uid].pending.push(r);
else if (r.status === 'paid') byPartner[uid].paid.push(r);
```

Also update the fetch query to include `approved` status:
```typescript
// BEFORE: no status filter (fetches all — already correct)
// confirm: the fetch has no .eq('status', ...) filter so this is fine
```
The fetch already gets all statuses — only the grouping needs fixing.

### Step 3 — Create a test case in DB to verify the full payout flow end-to-end

Insert one test case with `source = 'apply_page'`, set it to `enrollment_paid`, call `record_case_commission` with ₪4000, then verify the rewards row exists.

This will be done via a DB insert + RPC call using Supabase tools.

### Files to change

| File | Change |
|---|---|
| `public/locales/en/dashboard.json` | Add 14 missing keys to `admin.ready` block |
| `public/locales/ar/dashboard.json` | Add 14 missing keys to `admin.ready` block (Arabic) |
| `src/components/admin/PartnerPayoutsPanel.tsx` | Include `approved` status rewards in pending group |
