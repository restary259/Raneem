

# Comprehensive Dashboard & Data Flow Fix Plan

## Issues Identified (from screenshots and code review)

### 1. Merge "Legal/Visa Information" and "Visa & Language School Info" into one section
Currently StudentProfile.tsx has two separate cards. Merge them into a single "Visa Information" card. Visa status default should show "Pending" (not "Not Applied") and only change when admin updates it.

### 2. Table text wrapping/breaking issues (CRITICAL)
Screenshots show "Fam ily", "Pen ding", "2/17/2 026", "Da y", "Assign ed", "Pa id", "Reven ue", "Commiss ion", "Commissi on" all breaking mid-word.

**Root cause**: Table cells are too narrow and CSS allows `word-break` or `overflow-wrap` to split words. Fix by adding `whitespace-nowrap` to all table headers and relevant cells across:
- `ReferralTracker.tsx` (Referral Status table)
- `AdminAnalytics.tsx` (Team Performance and Agent Performance tables)
- `AppointmentCalendar.tsx` (Day view badge "Day" text)

### 3. Appointment modal - Date and Time inputs touching
Screenshot shows Date and Time fields side by side with no gap in the create dialog. The grid uses `gap-3` but the inputs are bordering each other visually. Add explicit spacing between them.

### 4. Calendar "Day" badge text breaking ("Da y")
The Day badge in the calendar header breaks the word. Add `whitespace-nowrap` to the Badge.

### 5. Notifications disappear too slowly
`TOAST_REMOVE_DELAY` is 2000ms but the toast animation/display duration is longer. The issue is the toast `duration` prop. Set toast default duration to 2000ms in the Toaster component so they auto-dismiss faster.

### 6. Bank details must persist to profile on save (Influencer)
EarningsPanel.tsx `saveBankDetails` already saves to profiles table. The data persists correctly. However, when admin views payout requests, the `payment_method` field shows the bank info string. The admin PayoutsManagement already shows this. Verify the admin can see bank details -- this is already working via the `payment_method` column on `payout_requests`.

### 7. Remove all popups/distractions from Apply page
Currently, PWAInstaller, InAppBrowserBanner, and CookieBanner only hide when `?ref=` is present. They should ALWAYS be hidden on `/apply` regardless of ref param. Update App.tsx to hide these on `/apply`.

### 8. Replace major typeahead with free-text input on Apply page
Remove the Popover/Command selector for majors in Step 3. Replace with a simple text Input field where students can type whatever they want.

### 9. Admin analytics tables word-breaking fix
Team Performance and Agent Performance tables in AdminAnalytics.tsx need `whitespace-nowrap` on headers and cells.

### 10. Lead generation from all sources must work
The apply page already calls `insert_lead_from_apply` RPC which creates leads. Contact page uses `upsert_lead_from_contact`. Referral form calls RPC too. Self-added referrals already work. The issue may be RLS -- leads are only visible to admins. Verify the flow works end-to-end.

### 11. Remove AI advisor icon from all dashboards
ChatWidget.tsx already hides on `/student-dashboard`, `/influencer-dashboard`, `/team-dashboard`, and `/admin` routes. This is already done.

### 12. Checkbox styling - make smaller and cleaner
The current Radix Checkbox has `rounded-sm` by default. Make them more like iOS-style checkmarks: smaller, with a clean checkmark icon, less rounded.

### 13. Settings panel checkbox styling
Same fix applies to settings panel checkboxes.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/StudentProfile.tsx` | Merge legal + visa sections into one "Visa Information" card. Default visa_status display as "Pending". |
| `src/components/dashboard/ReferralTracker.tsx` | Add `whitespace-nowrap` to table headers and badge/date cells to prevent word breaking. |
| `src/components/admin/AdminAnalytics.tsx` | Add `whitespace-nowrap` to all table headers in Team and Agent performance tables. |
| `src/components/lawyer/AppointmentCalendar.tsx` | 1. Add gap between Date/Time inputs. 2. Fix "Day" badge with `whitespace-nowrap`. |
| `src/hooks/use-toast.ts` | Reduce `TOAST_REMOVE_DELAY` to 1500ms for faster dismissal. |
| `src/components/ui/toaster.tsx` | Add `duration={2000}` to Toast component. |
| `src/App.tsx` | Hide PWAInstaller, InAppBrowserBanner, CookieBanner on ALL `/apply` visits (not just with `?ref=`). |
| `src/pages/ApplyPage.tsx` | Replace major typeahead (Popover/Command) with a free-text Input field. |
| `src/components/ui/checkbox.tsx` | Restyle to cleaner iOS-like design: smaller indicator, cleaner checkmark. |

---

## Technical Details

### StudentProfile.tsx Merge
Remove the second Card completely. Move Language School, Intake Month, Visa Status, and Arrival Date fields into the first card's form, under the legal fields section. Rename section header to "Visa Information". Map `not_applied` visa status to display as "Pending".

### Table Text Fix Pattern
Add `whitespace-nowrap` class to all `<th>` elements and date/badge `<td>` cells. This prevents mid-word breaks on mobile. The tables already have `overflow-x-auto` so horizontal scroll handles overflow.

### Apply Page Distraction-Free
Change App.tsx line 80 from:
```typescript
const isInfluencerApply = location.pathname === '/apply' && searchParams.has('ref');
```
to:
```typescript
const isApplyPage = location.pathname === '/apply';
```
And use `isApplyPage` for hiding PWAInstaller, InAppBrowserBanner, CookieBanner. Keep ChatWidget hidden on apply via its own logic.

### Major Field - Free Text
Replace the `MajorTypeahead` component in Step 3 with a simple `Input` field. The `preferredMajor` state will store the free text string directly instead of an ID.

### Checkbox Restyle
Update the Checkbox component to use `rounded-[4px]` instead of default, scale down the check icon, and use a cleaner SVG checkmark path.

### Toast Speed
Reduce `TOAST_REMOVE_DELAY` from 2000 to 1500ms and set explicit `duration={2000}` on the Toast to ensure auto-dismiss happens quickly.

