You are a senior full-stack engineer, database engineer, and security engineer working directly in the DARB repository.

The two Catalog fixes are **already implemented in the working tree**.

Your task now is **CODE-ONLY VERIFICATION + a focused Catalog audit**.

**Do NOT use browser testing, Playwright, manual UI testing, screenshots, or long-running test suites. I will personally verify the UI changes myself.**

Do not modify the existing fixes unless code inspection proves they are incorrect.

## Current verified state

### Issue 1 — Admin cannot delete Schools / Programs

Root cause previously confirmed:

- Schools had no delete action.
- Program/accommodation deletes used raw table deletes.
- Those deletes failed on `NO ACTION` foreign keys such as `case_submissions`, `service_catalog`, `important_contacts`, and `profiles`.
- The user received a raw Postgres error instead of a controlled response.
- There was no proper confirmation/dependency workflow.

Already implemented:

- Admin-only `SECURITY DEFINER` RPC `catalog_dependency_report`
- Admin-only `SECURITY DEFINER` RPC `delete_catalog_entity`
- Role re-check inside the RPC
- Dependency re-check inside the transaction
- Audit logging
- `CatalogDeleteDialog`
- Delete button on `SchoolInfoCard`
- Delete wiring for school/program/accommodation in `AdminProgramsPage`

### Issue 2 — Team accommodation photos cannot scroll

Root cause previously confirmed:

`AccommodationDetail` kept its Radix modal open while rendering `PhotoLightbox` into `document.body`.

The Radix modal applies `pointer-events: none` to the body, preventing lightbox arrows, thumbnails, and swipe interaction from receiving pointer events.

Already implemented:

- Detail dialog is controlled by `open && lightboxAt === null`
- Only one modal layer owns pointer events at a time
- `PhotoLightbox` explicitly uses `pointer-events: auto`
- Event propagation is stopped appropriately

# Your required work

## 1. Verify Issue 1 using code/database inspection only

Inspect the actual implementation and verify:

### `catalog_dependency_report`

Confirm:

- It is restricted to Admin.
- Authorization is checked server-side.
- Dependencies are calculated from the actual database relationships.
- `can_delete` is based on the real dependency result.
- It does not trust frontend-provided dependency information.
- It correctly handles school/program/accommodation entities.

### `delete_catalog_entity`

Confirm:

- It is restricted to Admin.
- The role is checked inside the RPC.
- Dependencies are re-checked inside the transaction.
- A frontend caller cannot bypass the dependency check.
- The deletion is atomic.
- Audit logging occurs correctly.
- Errors are controlled and meaningful.
- It cannot accidentally delete unrelated records.
- SQL injection or dynamic-table/entity manipulation is not possible.
- RLS/security is not weakened as a side effect of `SECURITY DEFINER`.

### Frontend wiring

Inspect:

- `CatalogDeleteDialog`
- `SchoolInfoCard`
- `AdminProgramsPage`
- related delete hooks/services

Confirm:

- The correct entity ID/type reaches the backend.
- Confirmation is required.
- Dependency information is displayed correctly.
- A blocked deletion presents the intended deactivate alternative.
- Success invalidates/refetches the correct catalog data.
- Error responses are handled instead of exposing raw database errors.
- No stale state causes deleted records to reappear.

### Deactivation

Verify in code that existing:

- deactivate
- reactivate

behavior remains intact and was not accidentally replaced by deletion logic.

---

## 2. Verify Issue 2 using code only

Inspect:

- `AccommodationDetail`
- `PhotoLightbox`
- the modal/dialog implementation
- photo state/navigation logic
- portal usage
- pointer/touch event handling
- overflow/layout classes

Verify from the code that:

- The Radix dialog is closed/inactive while the lightbox is open.
- The lightbox owns pointer events.
- `pointer-events: auto` is actually applied where required.
- Event propagation is correctly controlled.
- Previous/next navigation still works.
- Thumbnail interaction still works.
- Swipe/touch handlers can receive events.
- The full photo array is passed to the lightbox.
- Horizontal overflow is not accidentally disabled by a parent container.
- No duplicate modal layers remain active simultaneously.

Do not launch a browser to test this. Establish correctness through static code inspection and focused code-level checks only.

---

# 3. Focused Catalog audit

After verifying the two fixes, inspect the Catalog architecture from:

**Admin → Schools → Programs → Accommodations → Team**

Look only for **real, code-supported bugs**.

Check:

- create
- edit
- delete
- deactivate/reactivate
- dependency handling
- authorization
- RLS
- RPCs
- data fetching
- cache invalidation
- Admin → Team data propagation
- search/filter/sorting
- loading/error/empty states
- photo handling
- modal/dialog behavior
- mobile/overflow-related implementation
- stale data
- incorrect IDs/entity types
- silent API failures
- duplicated business logic

Do not redesign anything.

Do not make speculative changes.

Do not report something as a bug unless the code provides clear evidence that it is actually broken or unsafe.

---

# 4. Verification rules

This is **code verification, not UI verification**.

Do NOT:

- run Playwright
- launch a browser
- take screenshots
- perform manual UI testing
- run the entire test suite
- run long end-to-end tests
- repeatedly rerun failing tests
- enter an open-ended testing loop

Use focused static inspection, SQL inspection, type checking, linting, or narrowly targeted tests only when they are fast and directly relevant.

Do not run a verification command that is likely to take many minutes unless absolutely necessary.

Stop once there is enough evidence to determine correctness.

---

# Final response

Return only this structure:

## Issue 1 — Delete

**Code verification:** PASS / FAIL  
**Root cause:**  
**Evidence:**  
**Security:** PASS / FAIL  
**Data integrity:** PASS / FAIL  
**Conclusion:**

## Issue 2 — Photo Gallery

**Code verification:** PASS / FAIL  
**Root cause:**  
**Evidence:**  
**Conclusion:**

## Focused Catalog Audit

Only list **verified** additional bugs.

For every bug:  
**Severity → File/component → Problem → Evidence**

## Files Reviewed

List the relevant files inspected.

## Verification Performed

List only the focused code/database checks actually performed.

Do not claim browser/UI verification. I will personally perform that part.