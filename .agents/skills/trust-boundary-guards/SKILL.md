---
name: trust-boundary-guards
description: Enforce irreversible-action guards at the service/RPC layer, not just the UI. Detect change via identity, not count. Reuse expensive browser resources. Distilled from recurring code-review findings.
triggers:
  - /learn-from-reviews
---

# Trust-Boundary Guards & Derived-State Detection

Recurring review findings across the Raneem codebase. Three patterns kept
surfacing in code review (both human and automated) — apply them before
requesting review to short-circuit the same feedback.

## 1. Enforce irreversible-action guards at the service layer, not the UI

**The bug:** A destructive/irreversible state change (cancel, delete, pay,
submit) is gated in the React component, but the service function that
performs it has no guard. A retry, double-submit, stale closure, or a second
caller path bypasses the UI and re-runs the action — re-writing state and
logging a second audit event with stale data.

**Rule:** The guard belongs at the trust boundary (the service function or
RPC), because that is the one place every caller passes through. The UI gate
is for UX (hide the button), NOT for safety.

❌ Guard only in the component:
```tsx
// CaseDetailPage.tsx — button hidden on terminal status
const canCancel = canManage && !isTerminalStatus(caseData.status);
// but cancelCase() itself has no check → a retry re-cancels + logs a
// second case_cancelled event with a stale `from` status
```

✅ Guard in the service (the trust boundary):
```ts
export async function cancelCase(caseId, reason, currentStatus) {
  if (isTerminalStatus(currentStatus)) return; // idempotent no-op
  // ... UPDATE + log_case_event
}
```

**Applies to:** every status transition, every money write, every invite/send.
If the action is irreversible or mutates audit state, the service function
must be idempotent — a second call with the same args is a no-op, not a
duplicate write. The `record_case_commission`/`commission_split_done` +
`pg_advisory_xact_lock` pattern in the SQL engine is the canonical example;
mirror it in TS service functions.

**Verify staff-supplied IDs server-side too:** a `referrer_user_id` /
`partner_id` / `assigned_to` accepted from a staff caller must be
role-verified at the RPC/edge-function layer (is the referenced user actually
a partner/ambassador/team_member?), not trusted because the UI picker only
showed valid options. (PR #2 review finding: staff referrer accepted without
role verification.)

## 2. Detect "new item arrived" via identity, not array length

**The bug:** A `useEffect` reacts to "a new toast/message/notification was
added" by checking `toasts.length > prevLength`. But many stores cap the
array and replace in place (the shadcn `useToast` reducer does
`[newToast, ...rest].slice(0, TOAST_LIMIT)` with `TOAST_LIMIT=1`). When the
array is already full, the length stays the same → `1 > 1` is false → the
new item is silently skipped. The exact rapid-succession scenario the effect
exists to handle is the one it misses.

**Rule:** For "did a new item arrive" detection against a capped/replacing
store, track the newest item's **id**, not the count. A changed id is the
only reliable signal.

❌ Length-based (misses replacement):
```tsx
const prevCount = useRef(0);
useEffect(() => {
  if (toasts.length > prevCount.current) {           // 1 > 1 → false on 2nd toast
    playSound(toasts[toasts.length - 1].variant);
  }
  prevCount.current = toasts.length;
}, [toasts]);
```

✅ Identity-based (catches replacement):
```tsx
const prevId = useRef<string | null>(null);
useEffect(() => {
  const newest = toasts[0];                          // reducer prepends → index 0
  if (newest && newest.id !== prevId.current) {
    playSound(newest.variant);
  }
  prevId.current = newest?.id ?? null;
}, [toasts]);
```

**Generalizes:** any derived UI state that must recompute when its *inputs*
change — rebuild a localized list on language switch, refetch on role
change, re-resolve names when the referenced id changes. Count/length is a
fragile change-signal; identity (id) or the input value itself is robust.
(PR #4 review finding: next-steps list not rebuilt on language switch;
staff picker loading-state flash.)

## 3. Reuse expensive browser resources; clean up after terminal actions

**The bug:** A side-effect allocates a fresh expensive resource per
invocation and never releases it. Browsers cap concurrent instances
(AudioContext ~6 in Chrome, WebRTC peers, workers), so a long session
silently exhausts the pool and every later invocation fails into a `catch`
that hides the failure.

**Rule:** Hoist expensive, reusable resources to a module-level lazy
singleton. Never `new` them per call.

❌ Per-call allocation (leaks):
```ts
function playBeep() {
  const ctx = new AudioContext();   // new one every toast → pool exhausts
  // ...
}
```

✅ Reused singleton:
```ts
let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
```

**Sibling rule — reset UI state after a terminal action:** if a flow
succeeds (password changed, case submitted, payment confirmed), clear the
in-flight flags and close the dialog/modal so the user is not left staring
at a "processing" state on an already-completed action. (PR #1 review finding:
admin locked in password-change screen after success.)

## Quick pre-review checklist

Before opening a PR with a state-changing feature, confirm:

- [ ] The service function (not just the component) guards the irreversible
      action and is idempotent on retry.
- [ ] Any staff-supplied user/partner/team id is role-verified server-side.
- [ ] "New item arrived" effects use identity (id), not array length.
- [ ] Derived UI state recomputes on every input change (language, role, id).
- [ ] Expensive browser resources are reused singletons, not per-call `new`.
- [ ] UI flags/dialogs reset after the action succeeds (or fails).
- [ ] A pure-logic helper (payload normalization, status checks) has a test
      asserting on real outputs, not just that a mock was called.
