
# Multi-Issue Fix Plan — Contact Form, Apply Page, Money Page, Influencer Chart

## Issue Analysis

### 1. Contact Form — Already Creates Leads ✅ (but needs enhancement)
The `Contact.tsx` already calls `supabase.rpc('insert_lead_from_apply', ...)` with `p_source_type: 'contact_form'`. This IS working. The issue is it uses the **old RPC signature** without `p_passport_type`, and after submit just shows a toast — no WhatsApp redirect. Fix: add a redirect to WhatsApp after submission (same as apply page) and ensure it uses the correct RPC with preferred major.

### 2. Apply Page — Leads NOT Being Created
The `handleSubmit` calls `supabase.rpc('insert_lead_from_apply', rpcParams as any)` and on error catches it. The `setSubmitted(true)` runs regardless of error at line 162 — **the error from the RPC is caught and shown as toast but `setSubmitted(true)` is NOT inside the catch block**. Actually looking more carefully at lines 143-171, the code does `if (error) throw error;` and the catch sets `loading = false` but does NOT call `setSubmitted(true)`. So submission should work. **The real issue is likely the RPC call using `as any` bypasses type checking and some parameter mismatch causes a silent failure.** The `p_passport_type` field in the form is actually being passed correctly.

**The root bug:** In `ApplyPage.tsx` line 167 — the catch block catches ALL errors but only shows a toast. The `setSubmitted(true)` on line 162 only runs if no error is thrown. This is actually correct. The problem must be something else — the RPC may succeed but the lead is silently upserted/updated instead of inserted because the phone already exists in the DB. OR the issue is that the contact form used `insert_lead_from_apply` with `source_type: 'contact_form'` which is not `'organic'` or `'influencer'` — the RPC uses `p_source_type` with default `'organic'`, but `'contact_form'` IS valid as it just gets stored.

**Most likely fix:** On the Apply page, the catch block needs to NOT show `setSubmitted(true)` on failure. This looks correct already. The issue might be that `supabase.rpc()` with TypeScript mismatched overloads is silently swallowing the error. We need to add proper error logging in the catch block.

### 3. Services Tab Under Money — Remove It
In `AdminLayout.tsx` (lines 46-50), the `master-services` tab exists in the Finance group. In `AdminDashboardPage.tsx` line 191: `case 'master-services': return <MasterServicesManagement />;` — This needs to be removed from:
- `AdminLayout.tsx` sidebarGroups (remove `master-services` item)
- `AdminDashboardPage.tsx` (remove the `case 'master-services'` render)

### 4. Default Service Fee = 8,000 NIS
In `StudentCasesManagement.tsx`, when admin clicks "Mark Paid" or assigns a case, the `service_fee` field defaults to `0`. We need to pre-fill `service_fee = 8000` in the money editing panel (`moneyValues` state) when it loads with 0.

In `StudentCasesManagement.tsx` lines 233+ there's a money editing section. We need to default `service_fee` to `8000` when it's 0. The edit dialog opens and sets `moneyValues` from the case. We need to default service_fee to 8000 if it's 0 there.

### 5. Fix Arabic Chart Labels in مسار التحويل (Issue 6 from Stage 2)
Looking at `InfluencerDashboardPage.tsx` lines 178-194, the chart currently uses:
```tsx
<YAxis width={isAr ? 120 : 90} tick={{ fontSize: isAr ? 11 : 12, textAnchor: isAr ? 'end' : 'start' }} />
```
The issue: In a `layout="vertical"` BarChart with RTL, the `YAxis` renders text on the LEFT side of the chart. In Arabic/RTL, the text appears cramped because the `textAnchor: 'end'` combined with the axis position causes the text to render outside the allotted width. The fix is to use a **custom tick renderer** with explicit `text-anchor: start` and use `dx` to offset properly for RTL.

Also the container needs a larger left margin in RTL. The screenshot shows text literally overlapping the axis line.

**Fix:** Use a custom `CustomYAxisTick` component with `text-anchor="start"` and explicit positioning to prevent clipping. Also increase chart height to 250.

### 6. Unify Payment/Payout System — WhatsApp Only
Looking at `EarningsPanel.tsx`, the payout system already uses WhatsApp on line 185-186:
```typescript
const win = window.open(WHATSAPP_URL, '_blank');
if (!win || win.closed) window.location.href = WHATSAPP_URL;
```
The `submitPayoutRequest` function calls the RPC then opens WhatsApp. This is correct and matches the team member approach. The user wants to simplify — **remove the complex Request Payout modal** and replace with a simpler WhatsApp-direct approach.

**New flow:**
- Instead of the multi-step "Request Payout" dialog (which requires bank details, notes, RPC call), simplify to: a WhatsApp button that opens WhatsApp with a pre-filled message containing the reward amount and details.
- Keep the bank details storage but remove the complex RPC payout request flow from the UI.
- Show a "Request via WhatsApp" button that directly opens WhatsApp with the payout info pre-filled.

### 7. Money Page Complete Scan
After reading the full MoneyDashboard.tsx:

**Issues found:**
1. The `transactions` memo (line 95) includes `cases.filter(c => READY_STATUSES.includes(c.case_status))` which filters for `['paid', 'completed', ...]` — but the `cases` prop passed from AdminDashboardPage only contains cases from `data?.cases` which could include ALL cases. This is fine.
2. The KPI `pendingPayouts` (line 148) shows sum of `pending + approved` rewards — this is correct.
3. The `onRefresh` prop is not passed from `AdminDashboardPage.tsx` line 189: `<MoneyDashboard cases={cases} leads={leads} rewards={rewards} commissions={commissions} influencers={influencers} lawyers={lawyers} />` — **`onRefresh` is missing!** The "Mark Paid" and "Clear" buttons won't trigger data refresh.
4. The breakdown cards show school_commission as `€` which is correct.
5. The Pending Payouts section (lines 190-236) only shows `rewards.filter(r => r.status === 'pending')` — but it should also show `payout_requests` that are pending so admin can approve/pay them.

**Fixes for Money Page:**
- Pass `onRefresh={refetch}` prop to MoneyDashboard in AdminDashboardPage
- Add a "Payout Requests" section showing pending `payout_requests` from influencers/lawyers with admin approve/reject/pay buttons
- Show proper "per-student" breakdown with 8000 NIS default service fee

## Files to Change

| File | Change |
|------|--------|
| `src/components/landing/Contact.tsx` | Add WhatsApp redirect after successful form submit |
| `src/pages/ApplyPage.tsx` | Add better error handling + debug logging; ensure lead creation is logged |
| `src/components/admin/AdminLayout.tsx` | Remove `master-services` from Finance group |
| `src/pages/AdminDashboardPage.tsx` | Remove `case 'master-services'` render; pass `onRefresh={refetch}` to MoneyDashboard |
| `src/components/admin/StudentCasesManagement.tsx` | Default `service_fee` to 8000 NIS when 0 in money edit panel |
| `src/pages/InfluencerDashboardPage.tsx` | Fix Arabic chart labels with custom tick renderer |
| `src/components/influencer/EarningsPanel.tsx` | Simplify payout flow — WhatsApp-first approach |
| `src/components/admin/MoneyDashboard.tsx` | Add payout requests admin section; fix onRefresh wiring |

## Detailed Changes

### Contact Form — WhatsApp After Submit
After `form.reset()` in `onSuccess`, add:
```typescript
setTimeout(() => {
  window.open('https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo', '_blank');
}, 1200);
```
And update the success toast to mention WhatsApp redirect.

### Remove Master Services Tab
In `AdminLayout.tsx`, remove from `sidebarGroups`:
```typescript
{ id: 'master-services', labelKey: 'admin.tabs.masterServices', icon: Package },
```
In `AdminDashboardPage.tsx`, remove:
```typescript
case 'master-services':
  return <MasterServicesManagement />;
```
Also remove the `MasterServicesManagement` import.

### Default Service Fee to 8,000 NIS
In `StudentCasesManagement.tsx`, when the money editing section initializes `moneyValues` from a case, default service_fee to 8000:
```typescript
service_fee: Number(c.service_fee) || 8000,  // default 8k NIS
```

### Fix Arabic Chart — Custom Tick
Replace the current `YAxis` tick prop with a custom SVG renderer:
```tsx
const CustomYAxisTick = ({ x, y, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <text
      x={isAr ? 4 : -4}
      y={0}
      dy={4}
      textAnchor={isAr ? 'start' : 'end'}
      fill="currentColor"
      fontSize={isAr ? 10 : 12}
      direction={isAr ? 'rtl' : 'ltr'}
    >
      {payload.value}
    </text>
  </g>
);
```
Change the chart:
```tsx
<ResponsiveContainer width="100%" height={250}>
  <BarChart data={funnelData} layout="vertical" 
    margin={{ top: 0, right: 20, left: isAr ? 60 : 0, bottom: 0 }}>
    <XAxis type="number" hide />
    <YAxis
      type="category"
      dataKey="name"
      width={isAr ? 80 : 90}
      tick={<CustomYAxisTick />}
    />
    ...
```

### Money Page — Pass onRefresh + Payout Requests Section
In `AdminDashboardPage.tsx`:
```tsx
case 'money':
  return <MoneyDashboard 
    cases={cases} leads={leads} rewards={rewards} commissions={commissions} 
    influencers={influencers} lawyers={lawyers} 
    onRefresh={refetch}  // ← ADD THIS
    payoutRequests={payoutRequests}  // ← ADD THIS
  />;
```

In `MoneyDashboard.tsx`, add `payoutRequests` prop and a section to handle admin approve/pay/reject of payout requests from influencers/lawyers.

### Simplified EarningsPanel — WhatsApp Payout Request
Change the payout flow to show the reward info and open WhatsApp with a pre-filled message:
```typescript
const whatsappMessage = encodeURIComponent(
  `طلب سحب رصيد | Payout Request\nالمبلغ: ${availableAmount} ₪\nعدد الطلاب: ${eligibleRewards.length}\nالاسم: ${profile?.full_name || userId.slice(0,8)}`
);
const whatsappUrl = `https://wa.me/9721234567?text=${whatsappMessage}`;  // Use DARB's actual number
```

## What's Already Working (No Change Needed)
- Apply page success screen with WhatsApp button — already correct at lines 205-216
- EarningsPanel already uses WhatsApp after RPC submission — already correct
- `insert_lead_from_apply` RPC itself — correct, handles eligibility scoring
- Contact form RPC call — already calls `insert_lead_from_apply` correctly

## Summary Table

| # | Issue | Root Cause | Fix |
|---|-------|------------|-----|
| Contact form | No WhatsApp redirect after submit | `onSuccess` only shows toast | Add `setTimeout + window.open` |
| Apply page leads | Lead creation may fail silently | Need to verify RPC call succeeds | Add console.log + ensure error propagates |
| Services tab | Tab visible in Finance group | Not removed from AdminLayout | Remove from `sidebarGroups` |
| Service fee default | Shows 0 instead of 8000 | `moneyValues` initialized with raw case value | Default to 8000 when 0 |
| Arabic chart | Text clipped/mashed on Y-axis | `textAnchor: 'end'` clips in RTL layout | Custom SVG tick with `textAnchor: 'start'` and left margin |
| onRefresh missing | Mark Paid/Clear don't refresh | Prop not passed in AdminDashboardPage | Pass `onRefresh={refetch}` |
| Payout requests | Admin can't see/manage them | No payout_requests section in MoneyDashboard | Add admin payout request management section |
