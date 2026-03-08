
## Root Causes — Full Diagnosis

### Issue 1: Conversion Funnel chart squished (critical, visible in screenshot)
`AdminAnalyticsPage.tsx` uses a **vertical `BarChart` with `layout="vertical"`** and a fixed height of `300px` for **9 bars**. That gives only ~33px per bar row — not enough space for the Arabic Y-axis labels which are longer (e.g., "موعد محجوز"). The chart appears to have all labels stacked on top of each other.

**Root cause**: `height={300}` is too short for 9 labels + Y-axis width is `80px` in RTL which is insufficient for Arabic strings like "ملف" and "تقديم". Also `isRtl` makes the chart try to put margin on wrong side.

**Fix**:
- Increase height to `380px`
- Increase `yAxisWidth` from `80` to `130` in RTL
- Add `minPointSize={4}` so zero-value bars still show a sliver
- Add `overflow="visible"` on the `ResponsiveContainer`

### Issue 2: "Avg days per stage" X-axis Arabic labels overlap
The bottom BarChart (`avgDays`) uses `<XAxis dataKey="name" tick={{ fontSize: 10 }}` with no `angle` or `height`. For 7 Arabic labels like "موعد محجوز" at `fontSize: 10`, these will overlap each other at mobile widths.

**Fix**:
- Add `angle={-25}` `textAnchor="end"` `height={60}` to XAxis
- Or switch to vertical layout like the funnel chart

### Issue 3: Missing `admin.analytics` keys in AR locale used by `AdminOverview.tsx`
`AdminOverview.tsx` calls `t('admin.analytics.slaWarnings')`, `t('admin.analytics.monthlyBreakdown')`, `t('admin.analytics.revenue')`, `t('admin.analytics.teamComm')`, `t('admin.analytics.infComm')`, `t('admin.analytics.teamPerformance')`, `t('admin.analytics.influencerPerformance')`, `t('admin.analytics.leadsGenerated')`, `t('admin.analytics.name')`, `t('admin.analytics.assigned')`, `t('admin.analytics.paid')`, `t('admin.analytics.commission')`, `t('admin.analytics.funnelTitle')`.

Checking the AR locale `admin.analytics` section (lines 458–482), only basic keys exist. Missing:
- `slaWarnings` → "تحذيرات SLA"
- `monthlyBreakdown` → "التوزيع الشهري"
- `revenue` → "الإيرادات"
- `teamComm` → "عمولة الفريق"
- `infComm` → "عمولة الوكيل"
- `teamPerformance` → "أداء الفريق"
- `influencerPerformance` → "أداء الوكلاء"
- `leadsGenerated` → "عملاء محالون"
- `name` → "الاسم"
- `assigned` → "معيّن"
- `paid` → "مدفوع"
- `commission` → "العمولة"
- `funnelTitle` (from AdminOverview `t('admin.overview.funnelTitle')`) → missing in `admin.overview` section

Also `admin.overview` section needs:
- `funnelTitle` → "مسار العملاء"
- `newLeadsToday` → "عملاء جدد اليوم"
- `totalLabel` → "الإجمالي"
- `eligiblePct` → "نسبة المؤهلين"
- `conversionRate` → "معدل التحويل"
- `converted` → "تحويل"
- `revenueThisMonth` → "إيرادات الشهر"
- `activeCases` → "ملفات نشطة"
- `totalStudents` → "إجمالي الطلاب"
- `agents` → "الوكلاء"
- `totalPayments` → "إجمالي المدفوعات"
- `newMessages` → "رسائل جديدة"
- `newThisMonth` → "جديد هذا الشهر"

### Issue 4: Missing `kpi` keys in AR locale for `KPIAnalytics.tsx`
`KPIAnalytics.tsx` uses `t('kpi.conversionFunnel')`, `t('kpi.revenueTrend')`, `t('kpi.agentPerformance')`, `t('kpi.clients')`, `t('kpi.paidLabel')`, `t('kpi.exportRevenue')`, `t('kpi.exportLeads')`, `t('kpi.exportCases')`.

Checking the AR locale `kpi` section (line 833–847), missing:
- `conversionFunnel` → "مسار التحويل"
- `revenueTrend` → "منحنى الإيرادات"
- `paidLabel` → "مدفوع"
- `exportRevenue` → "تصدير الإيرادات"
- `exportLeads` → "تصدير العملاء"
- `exportCases` → "تصدير الملفات"

### Issue 5: `KPIAnalytics` conversion funnel chart — X-axis with Arabic labels not angled
The funnel `BarChart` in `KPIAnalytics.tsx` uses `<XAxis angle={-20} height={60}>` — angling is good, but Arabic characters rotate in unexpected directions. With RTL + angle -20 the labels still overlap. Should use `height={70}` and `fontSize: 9`.

### Issue 6: `AdminAnalyticsPage` — no RTL-aware chart direction
Recharts doesn't natively flip bar charts for RTL. The funnel vertical bar chart has `margin={{ left: 8, right: 0 }}` in RTL but the Y-axis (labels) are on the left in Recharts always. For Arabic RTL, the label side should be adjusted via `orientation="right"` on `YAxis` when `isRtl`.

## Files to Edit

| File | Change |
|---|---|
| `src/pages/admin/AdminAnalyticsPage.tsx` | Fix funnel chart height, yAxisWidth, RTL orientation, avg chart X-axis angle |
| `src/components/admin/KPIAnalytics.tsx` | Fix funnel X-axis angle/height for Arabic labels |
| `public/locales/ar/dashboard.json` | Add missing `admin.analytics.*`, `admin.overview.*`, and `kpi.*` keys |
| `public/locales/en/dashboard.json` | Add corresponding EN keys for parity |

## Exact Changes

### `AdminAnalyticsPage.tsx`
```tsx
// Funnel chart: height 300→380, yAxisWidth 80→130 RTL / 110 LTR
// Add YAxis orientation="right" when isRtl
// Add minPointSize={4} on Bar

// AvgDays chart: add angle={-25} textAnchor="end" height={65} to XAxis
```

### `public/locales/ar/dashboard.json` — add to `admin.analytics`:
```json
"slaWarnings": "تحذيرات SLA",
"monthlyBreakdown": "التوزيع الشهري",
"revenue": "الإيرادات",
"teamComm": "عمولة الفريق",
"infComm": "عمولة الوكيل",
"teamPerformance": "أداء الفريق",
"influencerPerformance": "أداء الوكلاء",
"leadsGenerated": "عملاء محالون",
"name": "الاسم",
"assigned": "معيّن",
"paid": "مدفوع",
"commission": "العمولة"
```
Add to `admin.overview`:
```json
"funnelTitle": "مسار العملاء",
"newLeadsToday": "عملاء جدد اليوم",
"totalLabel": "الإجمالي",
"eligiblePct": "نسبة المؤهلين",
"conversionRate": "معدل التحويل",
"converted": "تحويل",
"revenueThisMonth": "إيرادات الشهر",
"activeCases": "ملفات نشطة",
"totalStudents": "إجمالي الطلاب",
"agents": "الوكلاء",
"totalPayments": "إجمالي المدفوعات",
"newMessages": "رسائل جديدة",
"newThisMonth": "جديد هذا الشهر"
```
Add to `kpi`:
```json
"conversionFunnel": "مسار التحويل",
"revenueTrend": "منحنى الإيرادات",
"paidLabel": "مدفوع",
"exportRevenue": "تصدير الإيرادات",
"exportLeads": "تصدير العملاء",
"exportCases": "تصدير الملفات"
```

### `public/locales/en/dashboard.json` — add matching EN keys for parity
Same structure with English values.

**4 files touched total. No backend, logic, or component structure changes.**
