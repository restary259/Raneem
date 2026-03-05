
## Root Cause — Dual Auth Listener Causing Flicker

The `StudentAuthPage` has its OWN `onAuthStateChange` listener AND its own `getSession()` call, running in parallel with `AuthContext` which also subscribes to `onAuthStateChange`. This means:

1. User types a character → React re-renders → no issue there
2. BUT: `AuthContext.initializeAuth()` does 2 async DB calls (`get_my_role` + `profiles.must_change_password`) that resolve and call `setState()` — which triggers a global context re-render
3. The global re-render remounts `StudentAuthPage` → the page's OWN `useEffect` re-fires `getSession()` → calls `setUser()` → triggers ANOTHER re-render
4. Both listeners are fighting each other on every auth state event, causing the cascade

**The correct fix**: Strip ALL auth state management out of `StudentAuthPage`. The page should only:
- Read `useAuth()` from context
- If `initialized && user` → call `navigate(ROLE_TO_PATH[role])` in a `useEffect`
- Render the login form with `isLoading` state only for the submit action
- No local `user` state, no local subscriptions, no local `getSession()` call

### Plan

**`src/pages/StudentAuthPage.tsx` — full rewrite (lean)**
- Remove: `useState<User>`, `useEffect` with `onAuthStateChange`, `getSession`, `redirectByRole`, `navigateRef`, all local auth tracking
- Add: `const { initialized, user, role } = useAuth()`
- Add: single `useEffect` — if `initialized && user && role` → `navigate(ROLE_TO_PATH[role] ?? '/student/checklist')`
- Keep: `handleLogin` (submits to `auth-guard` edge function) — but after `setSession()` succeeds, AuthContext fires and the redirect `useEffect` handles navigation automatically
- Keep: `mustChangePassword` modal — but read from `useAuth().mustChangePassword` not from a local DB query
- Keep: "Back to main website" link, forgot password modal, show/hide password toggle
- Keep: all visual UI unchanged

**Result**: The page renders statically. No subscriptions. No re-renders during typing. AuthContext handles all auth state in one place.

### Files to change

| File | Change |
|---|---|
| `src/pages/StudentAuthPage.tsx` | Rewrite to use `useAuth()` only — remove all local auth subscriptions |

No other files need changes. The back-to-home link is already present (line 168-175). The `MobileNav` fix was already applied. This is a surgical single-file fix.
