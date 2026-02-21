
# Admin Dashboard Layout Optimization

## Problem Analysis

The current admin dashboard has **9 tabs across 5 groups**, with significant content overlap:

1. **Overview + Analytics overlap**: Both compute and display revenue KPIs, conversion rates, paid students, and influencer ROI. Overview shows 10 KPI cards + funnel. Analytics shows 6 KPI cards + chart + 2 performance tables. A user must visit two separate tabs to get a complete picture.

2. **Influencer Payouts + Money overlap**: The Money dashboard already has a "Payout Requests" approval panel and "Pending Rewards" section. The Influencer Payouts tab adds countdown tracking but duplicates the concept of managing influencer payments.

## Proposed Merged Structure

Current (9 tabs, 5 groups) --> Optimized (7 tabs, 4 groups):

```text
BEFORE                          AFTER
------                          -----
Dashboard                       Dashboard
  Overview                        Dashboard (merged Overview + Analytics)
  Analytics                     
                                Pipeline
Pipeline                          Leads
  Leads                           Student Cases
  Student Cases                 
                                People
People                            Team Members
  Team Members                    Students
  Students                      
  Influencers (payouts)         Finance
                                  Money (with Payouts sub-tab inside)
Finance                         
  Money                         System
                                  Settings
System
  Settings
```

---

## Step 1: Merge Overview + Analytics into Single "Dashboard" Tab

**File: `src/components/admin/AdminOverview.tsx`** -- Absorb analytics content

The merged view will have this layout (top to bottom):

1. **Primary KPI row** (6 cards, same as current Overview): New Leads Today, Eligible %, Conversion Rate, Revenue This Month, Active Cases, Influencer ROI
2. **Funnel Visualization** (unchanged)
3. **Monthly Revenue Chart** (moved from Analytics) -- the bar chart with revenue/team commission/influencer commission
4. **Secondary stats row** (4 compact cards: Total Students, Agents, Total Payments, Messages)
5. **Team Performance Table** (moved from Analytics)
6. **Influencer Performance Table** (moved from Analytics)

This gives the admin a single "command center" view instead of two half-views.

**File: `src/components/admin/AdminAnalytics.tsx`** -- Delete this file (all content absorbed into Overview)

**Props change**: AdminOverview will receive additional props that Analytics currently gets: `commissions` (needed for the useMemo dependency, though not directly used in calculations currently).

## Step 2: Fold Influencer Payouts into Money Dashboard as Sub-Tab

**File: `src/components/admin/MoneyDashboard.tsx`** -- Add internal Tabs

The Money dashboard will gain an internal tab bar at the top:

```text
[ Transactions ]  [ Influencer Payouts ]
```

- **Transactions tab**: Current MoneyDashboard content (KPIs, payout requests, pending rewards, transaction table)
- **Influencer Payouts tab**: Current InfluencerPayoutsTab content (countdown KPIs, per-influencer table with expandable rows)

This is a lightweight UI wrapping change using the existing `Tabs` component. The InfluencerPayoutsTab component itself stays untouched -- it just gets rendered inside MoneyDashboard's second tab.

**Props change**: MoneyDashboard will receive the additional `influencers` and `payoutRequests` props it already has, plus it needs no new data.

## Step 3: Update Sidebar

**File: `src/components/admin/AdminLayout.tsx`**

Remove the `analytics` item from the Dashboard group and the `influencers` item from the People group:

```text
Dashboard group:  [ overview ]              (was: overview, analytics)
Pipeline group:   [ leads, student-cases ]  (unchanged)
People group:     [ team, students ]        (was: team, students, influencers)
Finance group:    [ money ]                 (unchanged)
System group:     [ settings ]              (unchanged)
```

Also update `bottomNavItems` -- keep the same 4 items (overview, leads, student-cases, money).

## Step 4: Update AdminDashboardPage Router

**File: `src/pages/AdminDashboardPage.tsx`**

- Remove `case 'analytics'` and `case 'influencers'` from `renderContent()`
- Remove the `AdminAnalytics` and `InfluencerPayoutsTab` imports (Analytics is deleted; InfluencerPayoutsTab is now imported inside MoneyDashboard)
- Pass `commissions` to AdminOverview
- Pass `influencers`, `payoutRequests`, `rewards`, `leads`, `cases` to MoneyDashboard (most already passed)

## Step 5: Update Translation Keys

**Files: `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json`**

- Add `admin.money.tabTransactions` and `admin.money.tabPayouts` for the internal Money sub-tabs
- Existing analytics and influencer payout keys remain (they're still used, just in different locations)

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/admin/AdminOverview.tsx` | Merge in chart + performance tables from Analytics |
| `src/components/admin/AdminAnalytics.tsx` | Delete (content merged into Overview) |
| `src/components/admin/MoneyDashboard.tsx` | Add internal Tabs wrapping InfluencerPayoutsTab |
| `src/components/admin/AdminLayout.tsx` | Remove `analytics` and `influencers` sidebar items |
| `src/pages/AdminDashboardPage.tsx` | Remove 2 cases from renderContent, update imports/props |
| `public/locales/en/dashboard.json` | Add Money sub-tab labels |
| `public/locales/ar/dashboard.json` | Add Money sub-tab labels |

## What Does NOT Change

- InfluencerPayoutsTab.tsx -- untouched, just rendered inside MoneyDashboard
- All other tabs (Leads, Student Cases, Team, Students, Settings) -- untouched
- Database, edge functions, RLS -- no changes
- Data fetching layer (useDashboardData, dataService) -- no changes
- Real-time subscriptions -- no changes
