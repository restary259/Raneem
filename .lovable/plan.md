# Admin dashboard: rendering verification results and fix plan

## What was verified
- Signed a test browser in as the admin account (ranimdwahde3@gmail.com). Every admin page stops at **Two-Factor Verification**, which needs a live 6-digit code from your authenticator app. I cannot, and should not, bypass that screen, so no admin page could be viewed on screen yet.
- Ran a full code scan of all 16 admin pages and 60+ admin components for the layouts that cause overflowing or overlapping (titles next to buttons with no wrapping, fixed-width boxes on phones, side-by-side columns that don't shrink, and wide tables without sideways scrolling).
- Already fixed: Command Center cards, including Attribution integrity (earlier today).
- Confirmed fine: every standard table already scrolls sideways instead of spilling. Most settings and submission forms already stack into one column on phones.

## Findings (from the code scan)
1. **Page headers where the title and buttons collide on phones**: Submissions, Settings (2 spots), Pipeline card header, Member drawer (3 rows with a label and value).
2. **Fixed-width boxes that push past a 390px phone screen**:
   - Pipeline and Inbox search boxes (min 200–220px, beside other controls)
   - Data Requests filters (180/220px)
   - Auth Failures dropdown (170px)
   - Service Catalog note (200px)
   - Commission Hub rate labels and inputs (180/200px, 3 spots)
3. **Two- or three-column forms that never stack on phones**:
   - Service Catalog editor (4 spots, including a 3-column row)
   - Submissions detail (1)
   - Students (1)
   - Pipeline side panel (1)
   - Offices opening-hours times (1)
   - Settings (2)
4. **KPI tiles with long labels**: Commission Hub, Member drawer (2 grids), Settings (1). The labels need to wrap.
5. **Member list** (13 table blocks): long names and emails need shortening with "…".

## Fix plan (layout only, no data or behaviour changes)
- Headers: title takes the free space and wraps; buttons and badges keep their size (the same pattern as the Command Center fix).
- Fixed widths: full width on phones, keep the current size from tablet up.
- Forms: one column on phones, the current columns from tablet up. The 3-column Service Catalog row becomes 1, then 3.
- KPI labels wrap. Long names, emails and IDs are shortened with "…" and shown in full on hover.
- Check every changed page in Arabic and English at phone and desktop sizes.

## Needed from you to finish the on-screen check
I can't see any admin page on screen without a two-factor code. Two options:
- **Option A:** After I apply the fixes, open the changed pages on your phone and send screenshots of anything still broken.
- **Option B:** Give me a fresh 6-digit code the moment I ask. It expires in about 30 seconds, so this may take a few tries.

Until one of these happens, the findings above are backed by the code scan only and are not confirmed on screen.

## Technical notes
- Header pattern: `grid grid-cols-[minmax(0,1fr)_auto] gap-3`, title `min-w-0 break-words`, actions `shrink-0`.
- Fixed widths: `min-w-[Npx]` → `w-full sm:min-w-[Npx]`; `w-[170px]` → `w-full sm:w-[170px]`.
- Grids: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; grid children get `min-w-0`.
- Files:
  - AdminSubmissionsPage, AdminSettingsPage, AdminPipelinePage, AdminInboxPage, AdminStudentsPage, AdminOfficesPage, AdminCommissionHubPage
  - MemberDetailDrawer, MemberList, ServiceCatalogPanel, DataRequestsPanel, AuthFailuresPanel
- Verify with the build log and the i18n tests.
