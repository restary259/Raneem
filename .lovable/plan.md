
## Adding "Partner Payouts" Subtab to the Admin Finance Tab

### What exists today
- The Finance tab (`id: 'money'`) in AdminLayout renders the `MoneyDashboard` component inside a page. The current tab structure has only a single view under the "money" tab.
- The "Agent Payouts" subtab is `PayoutsManagement.tsx` — it handles `payout_requests` table (3-step approve flow). This is completely separate from the new feature which writes directly to `rewards`.
- `PasswordVerifyDialog` at `src/components/admin/PasswordVerifyDialog.tsx` already accepts `onVerified()` callback — reuse it directly.
- `rewards` table has: `id, user_id, amount, status (pending|paid), admin_notes, paid_at, created_at`.
- The `admin_notes` field for partner rewards follows the exact pattern: `'Partner commission from case ' + caseId`.
- `profiles` table has `full_name, email, avatar_url`.

### Architecture decision: where does the Finance tab live?
Looking at the admin dashboard, the `money` tab renders `MoneyDashboard` (which is the transactions/money view). The spec says to add a subtab **inside** the Finance tab. This means converting the Finance area from a flat page to a tabbed view with subtabs: "Overview" (existing MoneyDashboard), "Agent Payouts" (existing PayoutsManagement), and the new "Partner Payouts".

Currently `AdminOverview.tsx` is what renders tabs. Let me check how the `money` tab is rendered in the admin dashboard page.

The tab `id: 'money'` maps to the finance section. The admin dashboard renders content per `activeTab`. I need to find where `money` is rendered and add a subtabs wrapper.

### Files to create
1. **`src/components/admin/PartnerPayoutsPanel.tsx`** — the entire new feature component

### Files to modify
1. **`src/pages/StudentDashboardPage.tsx`** OR wherever the admin `money` tab content is rendered — add a subtabs UI with "Overview", "Agent Payouts", "Partner Payouts" tabs (need to locate the render switch)
2. **`src/pages/partner/PartnerOverviewPage.tsx`** — replace single "projected total" KPI card with two cards: "إجمالي المدفوع هذا الشهر" (paid this month from `rewards` where `status='paid'` and `paid_at` in current month) and "إجمالي المدفوع الكلي" (all-time paid from `rewards`)
3. **`src/pages/partner/PartnerEarningsPage.tsx`** — add "سجل المدفوعات" section at the bottom; fetch `rewards` where `status='paid'` and `user_id=uid`; parse case ID from `admin_notes`; fetch `cases` for names; display sorted by `paid_at` desc

### Finding the money tab render location
Need to check where `activeTab === 'money'` renders its content — it's likely in the same page that uses AdminLayout.

---

### PartnerPayoutsPanel — Data Flow

```text
FETCH
  rewards (admin_notes LIKE 'Partner commission from case%')
    JOIN profiles!inner(full_name, email, avatar_url)
  → parse caseId from admin_notes for each reward
  → fetch cases IN (all extracted case IDs) → get full_name per case

GROUP by user_id → one entry per partner

DISPLAY
  For each partner:
    Card: name, avatar, pending total (amber), paid-this-month (green), paid-all-time (green)
    Collapsible breakdown below card:
      pending rows expanded by default
      paid rows collapsed under "Show paid history" toggle
    Each pending row: student name, source, amount, status badge, created_at, "Confirm Payment" btn
    Each paid row: student name, source, amount, "Paid" badge, created_at, paid_at

  "Pay All Pending" on partner card: bulk confirm all their pending rewards
```

### Confirm Payment Flow (both single and bulk)
```text
1. PasswordVerifyDialog (reuse existing, onVerified callback)
2. AlertDialog confirmation summary (single vs bulk text)
3. On confirm:
   UPDATE rewards SET status='paid', paid_at=now() WHERE id IN (...)
   INSERT admin_audit_log for each reward
4. Optimistic update: mutate local state (move rows from pending → paid)
5. Toast success
```

### Realtime
Add a `useRealtimeSubscription('rewards', refetch, true)` so admin tab updates live when another admin confirms in another browser tab. The partner pages already subscribe to `rewards` via `useRealtimeSubscription` — so the partner's overview and earnings will update automatically once status changes.

---

### Partner Overview Page changes
Replace the existing "إجمالي الأرباح المتوقعة" KPI with **two new reward-table-backed KPIs**:
- Fetch `rewards WHERE user_id=uid AND status='paid'` 
- **This month**: filter `paid_at >= start of current month`
- **All time**: sum everything

Keep the existing projection-based earnings banner untouched (it shows projected, the new cards show actual paid).

### Partner Earnings Page changes  
Add a new card at the bottom after the pipeline section:
- Title: `سجل المدفوعات` / "Payment History"
- Fetch `rewards WHERE user_id=uid AND status='paid'`
- Parse case UUID from `admin_notes.replace('Partner commission from case ', '').trim()`
- Fetch case names in one batch `IN` query
- Sort by `paid_at` DESC
- Each row: student first name | amount | paid_at date
- Empty state: `لا توجد مدفوعات مؤكدة بعد`

---

### Finding the money tab rendering

I need to check where the admin `money` tab content renders to know how to add subtabs. The AdminLayout just renders `{children}` — the tab switching logic is in a parent page. Need to look at where `AdminLayout` is used.
