
## Issues to Fix

### Bug 1 — `profiles!inner` join fails (the red error)
Supabase requires a declared foreign key to use the PostgREST join syntax. `rewards.user_id` has no FK to `profiles`. Fix: split into 2 queries in `PartnerPayoutsPanel.tsx`:
- Query 1: fetch rewards (no join)
- Query 2: fetch profiles `IN` the distinct `user_id` set
- Merge manually in JS

### Bug 2 — Missing `admin.payouts` locale block
`PayoutsManagement.tsx` references these keys that don't exist in either locale file:
- `admin.payouts.requester`, `admin.payouts.amount`, `admin.payouts.role`, `admin.payouts.status`, `admin.payouts.requestDate`, `admin.payouts.action`, `admin.payouts.linkedStudents`, `admin.payouts.paymentMethodCol`, `admin.payouts.all`, `admin.payouts.allRoles`, `admin.payouts.exportCSV`, `admin.payouts.statusUpdated`, `admin.payouts.unknownRequester`, `admin.payouts.noRewards`, `admin.payouts.pay`, `admin.payouts.approveBtn`, `admin.payouts.rejectBtn`, `admin.payouts.bulkApprove`, `admin.payouts.bulkReject`, `admin.payouts.pendingInfluencer`, `admin.payouts.pendingStudent`, `admin.payouts.totalPaid`, `admin.payouts.totalRejected`, `admin.payouts.statuses.*`, `admin.payouts.methods.*`
- Also: `admin.payouts.approveTitle`, `admin.payouts.notesOptional`, `admin.payouts.rejectTitle`, `admin.payouts.rejectReason`, `admin.payouts.markPaidTitle`, `admin.payouts.paymentMethod`, `admin.payouts.selectMethod`, `admin.payouts.transactionRef`, `admin.payouts.confirmPay`, `admin.payouts.noLinkedStudents` (from `PayoutActionModals` and `LinkedStudentsModal`)

### Bug 3 — Missing `admin.referralsMgmt` locale keys
`PayoutsManagement.tsx` uses `t('admin.referralsMgmt.agent')` and `t('admin.referralsMgmt.student')` for role labels — these don't exist. Must add them, and rename "agent" → "partner" per the platform's role naming.

### Bug 4 — "Agent Pending" label → rename to "Partner Pending"
- `admin.payouts.pendingInfluencer` label in EN = "Agent Pending" → change to "Partner Pending"
- AR equivalent = "طلبات الشريك المعلقة"
- Role filter value `value="influencer"` → `value="social_media_partner"` (the actual DB value)

### Files to change

| File | Change |
|------|--------|
| `src/components/admin/PartnerPayoutsPanel.tsx` | Remove `profiles!inner` join; add second query for profiles by `user_id IN [...]`; merge into `RewardRow` manually |
| `public/locales/en/dashboard.json` | Add complete `admin.payouts` block + `admin.referralsMgmt.agent` + `admin.referralsMgmt.student` keys |
| `public/locales/ar/dashboard.json` | Same keys in Arabic |
| `src/components/admin/PayoutsManagement.tsx` | Fix role filter: `value="influencer"` → `value="social_media_partner"`; fix `RoleBadge` to use correct key |

### New locale keys to add to EN:
```json
"admin": {
  ...existing...,
  "referralsMgmt": {
    ...existing (already has some keys)...,
    "agent": "Partner",
    "student": "Student"
  },
  "payouts": {
    "requester": "Requester",
    "amount": "Amount",
    "role": "Role",
    "status": "Status",
    "requestDate": "Request Date",
    "action": "Action",
    "linkedStudents": "Students",
    "paymentMethodCol": "Method",
    "all": "All",
    "allRoles": "All Roles",
    "exportCSV": "Export CSV",
    "statusUpdated": "Status updated",
    "unknownRequester": "Unknown",
    "noRewards": "No payout requests",
    "pay": "Pay",
    "approveBtn": "Approve",
    "rejectBtn": "Reject",
    "bulkApprove": "Bulk Approve",
    "bulkReject": "Bulk Reject",
    "pendingInfluencer": "Partner Pending",
    "pendingStudent": "Student Pending",
    "totalPaid": "Total Paid",
    "totalRejected": "Rejected",
    "approveTitle": "Approve Payout",
    "rejectTitle": "Reject Payout",
    "rejectReason": "Reason (required)",
    "markPaidTitle": "Mark as Paid",
    "paymentMethod": "Payment Method",
    "selectMethod": "Select method",
    "transactionRef": "Transaction ID / Reference",
    "notesOptional": "Notes (optional)",
    "confirmPay": "Confirm Payment",
    "noLinkedStudents": "No linked students",
    "statuses": {
      "pending": "Pending",
      "approved": "Approved",
      "paid": "Paid",
      "rejected": "Rejected"
    },
    "methods": {
      "bank": "Bank Transfer",
      "paypal": "PayPal",
      "cash": "Cash",
      "bank_transfer": "Bank Transfer"
    }
  }
}
```

### AR equivalents:
```json
"referralsMgmt": {
  "agent": "الشريك",
  "student": "الطالب"
},
"payouts": {
  "requester": "مقدم الطلب",
  "amount": "المبلغ",
  "role": "الدور",
  "status": "الحالة",
  "requestDate": "تاريخ الطلب",
  "action": "الإجراء",
  "linkedStudents": "الطلاب",
  "paymentMethodCol": "طريقة الدفع",
  "all": "الكل",
  "allRoles": "جميع الأدوار",
  "exportCSV": "تصدير CSV",
  "statusUpdated": "تم تحديث الحالة",
  "unknownRequester": "غير معروف",
  "noRewards": "لا توجد طلبات صرف",
  "pay": "دفع",
  "approveBtn": "موافقة",
  "rejectBtn": "رفض",
  "bulkApprove": "موافقة جماعية",
  "bulkReject": "رفض جماعي",
  "pendingInfluencer": "طلبات الشريك المعلقة",
  "pendingStudent": "طلبات الطالب المعلقة",
  "totalPaid": "إجمالي المدفوع",
  "totalRejected": "مرفوض",
  "approveTitle": "الموافقة على الصرف",
  "rejectTitle": "رفض الصرف",
  "rejectReason": "السبب (مطلوب)",
  "markPaidTitle": "تأكيد الدفع",
  "paymentMethod": "طريقة الدفع",
  "selectMethod": "اختر طريقة",
  "transactionRef": "رقم المعاملة / المرجع",
  "notesOptional": "ملاحظات (اختياري)",
  "confirmPay": "تأكيد الدفع",
  "noLinkedStudents": "لا يوجد طلاب مرتبطون",
  "statuses": {
    "pending": "معلق",
    "approved": "موافق عليه",
    "paid": "مدفوع",
    "rejected": "مرفوض"
  },
  "methods": {
    "bank": "تحويل بنكي",
    "paypal": "باي بال",
    "cash": "نقداً",
    "bank_transfer": "تحويل بنكي"
  }
}
```

### Check for `admin.referralsMgmt` in EN locale
Need to check if this key exists already in EN locale before adding. From the search, `admin.referralsMgmt` is used in `PayoutsManagement.tsx` and `ReferralManagement.tsx`. It does NOT appear in search results of the locale files — so these are also broken/untranslated keys. Need to add them.

### PartnerPayoutsPanel fix — two-query approach:
```typescript
// Step 1: fetch rewards only
const { data: rewardRows } = await supabase
  .from('rewards')
  .select('id,amount,status,created_at,paid_at,admin_notes,user_id')
  .like('admin_notes', 'Partner commission from case%')
  .order('created_at', { ascending: false });

// Step 2: fetch profiles separately
const userIds = [...new Set(rewardRows.map(r => r.user_id))];
const { data: profileRows } = await supabase
  .from('profiles')
  .select('id,full_name,email,avatar_url')
  .in('id', userIds);

// Merge
const profileMap = Object.fromEntries(profileRows.map(p => [p.id, p]));
const rows = rewardRows.map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null }));
```

### Execution order:
1. Fix `PartnerPayoutsPanel.tsx` — split join into 2 queries
2. Add `admin.payouts` block to `en/dashboard.json` 
3. Add `admin.payouts` block to `ar/dashboard.json`
4. Add `admin.referralsMgmt.agent` + `.student` to both locale files
5. Fix `PayoutsManagement.tsx` role filter value `influencer` → `social_media_partner`

### Note on `admin.referralsMgmt` existing keys
Need to check what already exists in `admin` section. The search showed no match for `admin.referralsMgmt` in locale files — so these are completely missing. However the component `ReferralManagement.tsx` uses many `admin.referralsMgmt.*` keys. This is a wider pre-existing gap. Only add the two keys actively needed by `PayoutsManagement.tsx` (`agent` and `student`) without restructuring other components.
