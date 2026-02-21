

# Single-Session Enforcement Per Account

## Overview

Implement a system where each user account can only have one active session at a time. When a user logs in on a new device/browser, the previous session is invalidated gracefully with a clear notification.

## Architecture

The approach uses a **session token tracking table** in the database combined with a **frontend heartbeat/polling mechanism**:

1. A new `active_sessions` table stores the current valid session token per user
2. On login, the `auth-guard` edge function writes the new session ID, invalidating any previous one
3. The frontend periodically checks if its session is still the active one; if not, it shows a modal and logs the user out

This avoids modifying reserved auth schemas and works entirely within public schema + edge functions.

## Technical Details

### 1. Database Migration -- `active_sessions` table

```sql
CREATE TABLE public.active_sessions (
  user_id uuid PRIMARY KEY,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own row to check if their session is still active
CREATE POLICY "Users can view own session"
  ON public.active_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (edge functions) can insert/update/delete
-- No INSERT/UPDATE/DELETE policies for regular users

-- Enable realtime for instant invalidation detection
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
```

### 2. Update `auth-guard` Edge Function

After successful login, upsert into `active_sessions` with the new session's access token (or a hash/ID derived from it):

```typescript
// After successful login, register this as the active session
const sessionId = data.session.access_token.slice(-32); // last 32 chars as identifier
await supabaseAdmin.from('active_sessions').upsert({
  user_id: data.user.id,
  session_id: sessionId,
  ip_address: ip,
  user_agent: req.headers.get('user-agent') || 'unknown',
}, { onConflict: 'user_id' });
```

### 3. New Frontend Hook -- `useSessionGuard`

Create `src/hooks/useSessionGuard.ts`:

- On mount, derive the current session ID from the stored access token
- Subscribe to `active_sessions` table via Supabase Realtime (filtered to own user_id)
- When a change is detected and the `session_id` no longer matches, show a modal/toast and sign out
- Fallback: poll every 60 seconds in case realtime misses an event

When the session is invalidated:
- Show a clear `AlertDialog` saying "Your account was logged in from another device. You have been signed out."
- After user acknowledges (or after 5 seconds), call `supabase.auth.signOut()` and redirect to `/student-auth`

### 4. Integrate `useSessionGuard` in `App.tsx`

Add the hook call alongside the existing `useSessionTimeout()` in App.tsx. The guard only activates when a user is logged in.

### 5. Handle Direct Logins (non-auth-guard path)

For student signups and password-based logins that bypass `auth-guard` (e.g., `supabase.auth.signUp`), add session registration in the `onAuthStateChange` handler or after `setSession`. This ensures all login paths are covered.

### 6. Audit Logging

When a session is replaced, the `auth-guard` function will also insert into `admin_audit_log`:
```
action: 'SESSION_REPLACED'
details: 'Previous session invalidated due to new login from IP: x.x.x.x'
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `active_sessions` table | Create via migration |
| `supabase/functions/auth-guard/index.ts` | Add session upsert after login |
| `src/hooks/useSessionGuard.ts` | New -- realtime session monitor + invalidation modal |
| `src/App.tsx` | Add `useSessionGuard()` call |

## What Stays Unchanged

- All dashboard logic (cases, money, analytics, influencer, team)
- Real-time subscriptions for business data
- Session timeout logic for admins
- The `must_change_password` flow
- Rate limiting and login attempt tracking
- All RLS policies on existing tables

## Edge Cases Handled

- **Tab refresh**: Session ID is re-derived from the stored token; still valid unless another login occurred
- **Network delays**: Fallback polling ensures detection even if realtime channel drops
- **Concurrent actions**: The invalidated session's Supabase JWT remains technically valid until expiry, but the frontend will block further actions by signing out immediately
- **Signup flow**: New signups get registered in `active_sessions` so they are also protected
- **Token refresh**: When Supabase refreshes the JWT, the session ID check uses a stable identifier (user_id row), not the token itself -- so token refresh does not trigger false invalidation

