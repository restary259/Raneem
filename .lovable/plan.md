

## DSOS Ultimate Security Hardening Plan

This plan addresses all actionable security findings from the scan and implements the comprehensive security measures you outlined. Changes are organized by priority.

---

### Phase 1: Fix Active Security Findings (Critical)

#### 1A. Remove Temp Password Exposure from API Responses
**Problem**: `create-team-member` and `create-influencer` edge functions return plaintext temp passwords in the API response body. These are visible in browser DevTools.

**Fix**: Instead of returning the password in the response, send it to the new team member via email using the existing `send-branded-email` function or built-in Supabase email. The admin UI will show a success message without the password.

**Files**:
- `supabase/functions/create-team-member/index.ts` -- remove `temp_password` from response, send password via email to the new user
- `supabase/functions/create-influencer/index.ts` -- same fix, also add `must_change_password: true` to profile (currently missing)

#### 1B. Fix "RLS Policy Always True" on contact_submissions
**Problem**: The `Anyone can submit contact form` INSERT policy uses `WITH CHECK (true)`, flagged by the linter.

**Fix**: This is intentional for public contact forms, but we should tighten it by restricting which columns can be set. Since the `send-email` edge function uses service role to insert, we can safely remove the public INSERT policy and rely entirely on the edge function (which already validates and sanitizes input).

**Migration**: Drop the `Anyone can submit contact form` policy.

#### 1C. Address profiles/leads exposure warnings
**Problem**: Scanner flags that profiles and leads tables lack explicit "deny anonymous" policies. While RLS is enabled and all existing policies require `auth.uid()`, adding explicit denial is defense-in-depth.

**Fix**: These tables already have RLS enabled with policies that all check `auth.uid()` or `has_role()`. Anonymous users cannot match any policy. This is already secure by default (RLS denies when no policy matches). We will mark these findings as acknowledged with justification rather than adding redundant policies.

---

### Phase 2: Security Headers and CSP Enhancement

#### 2A. Strengthen Content-Security-Policy
**Current**: `Content-Security-Policy: upgrade-insecure-requests` (minimal)

**Fix**: Update `public/_headers` with a more comprehensive CSP:
- Add `default-src 'self'`
- Add `script-src 'self'` (with necessary hashes/nonces for inline scripts)
- Add `style-src 'self' 'unsafe-inline' fonts.googleapis.com`
- Add `font-src fonts.gstatic.com`
- Add `img-src 'self' data: blob: *.supabase.co`
- Add `connect-src 'self' *.supabase.co`
- Add `frame-ancestors 'none'` (replaces X-Frame-Options)

Note: CSP will need testing to ensure no legitimate resources are blocked.

---

### Phase 3: PWA and Cache Security

#### 3A. Clear sensitive data from service worker caches on logout
**Status**: Already implemented -- the service worker handles `CLEAR_CACHES_ON_LOGOUT` messages and the `useSessionTimeout` hook clears caches. This is verified and working.

#### 3B. Prevent caching of sensitive dashboard routes
**Status**: Already implemented -- the service worker uses network-only for navigation requests and never caches Supabase API calls. Verified and working.

---

### Phase 4: Input Validation Hardening

#### 4A. Email validation in edge functions
**Current**: `auth-guard` accepts any email string without validation.

**Fix**: Add email format validation in `auth-guard/index.ts` before attempting login:
```typescript
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
}
```

#### 4B. Input length limits in team creation functions
Add explicit length limits for `email` (max 255), `full_name` (max 100), and `role` validation in both `create-team-member` and `create-influencer`.

---

### Phase 5: Resolve Remaining Scan Findings

After implementing the above, update the security findings:
- **Delete** `temp_password_in_response` finding (fixed)
- **Ignore** `profiles_table_public_exposure` and `leads_table_sensitive_exposure` with justification (RLS deny-by-default already protects)
- **Ignore** `user_roles_partial_public_access` with justification (needed for public referral link validation)
- **Ignore** `SUPA_rls_policy_always_true` for checklist_items SELECT (intentional public read for authenticated users)

---

### Technical File Summary

| Action | File | Changes |
|--------|------|---------|
| Edit | `supabase/functions/create-team-member/index.ts` | Remove temp_password from response, send via email, add input validation |
| Edit | `supabase/functions/create-influencer/index.ts` | Remove temp_password from response, add must_change_password, send via email, add input validation |
| Edit | `supabase/functions/auth-guard/index.ts` | Add email format validation and input length limits |
| Edit | `public/_headers` | Strengthen CSP headers |
| Migration | Drop `Anyone can submit contact form` INSERT policy | Tighten contact_submissions access |
| Security findings | Update/ignore justified findings | Clean up scan results |

### Implementation Order
1. Edge function fixes (temp password removal + input validation)
2. Database migration (contact_submissions policy)
3. Security headers update
4. Security findings cleanup and re-scan

