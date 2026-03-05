
## Root Cause (Confirmed from Logs)

**`create-team-member`**: Boot failure — `SyntaxError: Identifier 'token' has already been declared` at line 36. The variable `token` is declared twice (line 29 AND line 36). The function crashes before it can even handle a request.

**`create-influencer`**: Uses `supabaseUser.auth.getUser()` (line 35) without passing the token. This fails with Lovable Cloud's ES256 JWTs. Must use `getClaims(token)` instead — same fix that was applied to `create-team-member` but accidentally introduced a duplicate `const token`.

## Fix Plan

### File 1: `supabase/functions/create-team-member/index.ts`
Remove the duplicate `const token` at line 36. Keep only the one at line 29, and pass it to `getClaims()`.

**Before (broken):**
```typescript
const token = authHeader.replace("Bearer ", "");  // line 29
const supabaseUser = createClient(...);

const token = authHeader.replace("Bearer ", "");  // line 36 — DUPLICATE CRASH
const { data: claimsData } = await supabaseUser.auth.getClaims(token);
```

**After (fixed):**
```typescript
const token = authHeader.replace("Bearer ", "");  // only once
const supabaseUser = createClient(...);

const { data: claimsData } = await supabaseUser.auth.getClaims(token); // use existing token
```

### File 2: `supabase/functions/create-influencer/index.ts`
Replace `supabaseUser.auth.getUser()` with `getClaims(token)` pattern (same as fixed team-member):

```typescript
// Remove:
const { data: userData, error: userError } = await supabaseUser.auth.getUser();
if (userError || !userData?.user) { ... }
const adminId = userData.user.id;

// Replace with:
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const adminId = claimsData.claims.sub;
```

Both files get the same working auth pattern. Two minimal, targeted fixes.
