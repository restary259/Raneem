# Apply the Visa Information database update

## What happens
Run the visa form's database update for you, so students can save and submit the Visa Information form and the team can review it.

- Adds only: new columns on the visa application record and three actions (save step, submit, review).
- Nothing is changed or deleted. Existing visa data stays as it is.

## Steps
1. Apply `docs/manual-sql/20261006130000_visa_information.sql` byte-for-byte as a database migration (the user explicitly asked for this one instead of a manual deploy).
2. Verify on the live database: the 8 `info*` columns exist and the functions `save_my_visa_info`, `submit_my_visa_info`, `review_visa_info` exist with EXECUTE granted to signed-in users only.
3. Confirm `log_case_event(uuid, text, jsonb)` exists, since submit/review call it; if its signature differs, stop and report instead of guessing.
4. Open the student Visa page in the preview and save one step to confirm it works, then report.

## Rollback
Additive only; if needed, the functions can be dropped and the columns left unused.
