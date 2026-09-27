# Admin calling, call error fix, and chat header overlap

## 1. Fix "invalid input syntax for type uuid: 1" (confirmed cause)
Every call attempt fails with this error. The call starter checks the shared conversation with `SELECT 1 INTO v_thread`, trying to store the number 1 in an ID field. Change it to store the real conversation ID, so the check works and calls can start.

## 2. Admin can call anyone
- Admin may call any live user (team, partner, agent, ambassador, student), no toggle needed on either side.
- When admin calls someone whose toggle is off, the call turns their toggle ON automatically (recorded in the admin audit log) and rings them.
- If admin and the person have no conversation yet, one is created automatically so the call has a home.
- Non-admin rules stay exactly as today (both toggled on + existing conversation).
- The call button shows for admin in every conversation, desktop and mobile.

## 3. Chat header hidden behind the navigation bar
On phone-size screens the open conversation and the bottom navigation both use the same layer, so the navigation covers parts of the chat (back arrow, header, composer). Fix: open the full-screen conversation above the navigation (placed at page level, higher layer) and respect safe areas, so the back arrow, name, call button and composer are always visible. Verify with screenshots at mobile and desktop widths.

## Technical details
- New migration: `CREATE OR REPLACE start_voice_call`:
  - `SELECT p1.thread_id INTO v_thread` in the explicit-thread branch.
  - If `has_role(v_me,'admin')`: skip `can_communicate_directly`; require callee profile live; `UPDATE profiles SET voice_calls_enabled = true` when false (definer context passes `restrict_profiles_write` since caller is admin) + `admin_audit_log` row; find or create a direct thread (reuse existing thread-creation helper, add both participants).
  - Non-admin path unchanged. Keep grants.
- `VoiceCallButton`/eligibility: treat admin caller as eligible for any counterpart.
- `CaseMessagesInboxPage`: render the `FS_CHAT` panel via portal to `document.body` with `z-[60]`, add `pt-safe`; keep desktop layout unchanged.
- Verify: re-run call start from a test admin session (expect ringing row, no 22P02), typecheck, Playwright screenshots at 577px and 1280px.
