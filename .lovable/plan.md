
## Graceful Error Handling for Missing API Key

### Problem
Currently, when the `UNIPLACES_API_KEY` is not configured, the edge function returns a raw error response (`500: {"error":"API key not configured"}`), which looks unprofessional to users viewing the housing page.

### Solution
Update the `supabase/functions/uniplaces-proxy/index.ts` edge function to return a graceful "coming soon" message instead of a technical error.

### Changes Required

**File: `supabase/functions/uniplaces-proxy/index.ts`**

Replace the API key check (lines 15-21) with a user-friendly response:

**Current (lines 15-21):**
```typescript
const apiKey = Deno.env.get('UNIPLACES_API_KEY');
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'API key not configured' }),
    { status: 500, headers: corsHeaders }
  );
}
```

**Updated:**
```typescript
const apiKey = Deno.env.get('UNIPLACES_API_KEY');
if (!apiKey) {
  return new Response(
    JSON.stringify({ 
      message: 'Student housing search is coming soon. Please check back later!' 
    }),
    { status: 503, headers: corsHeaders }
  );
}
```

### Benefits
- **User-friendly**: Students see a polished "coming soon" message instead of a technical error
- **Better status code**: Uses `503 Service Unavailable` (appropriate for temporarily disabled services) instead of `500 Internal Server Error`
- **Clear messaging**: Explains that the feature is coming, not broken
- **No frontend changes needed**: The frontend components already exist and are ready; they'll simply show a nice message when the key isn't configured yet

### Impact
Once the `UNIPLACES_API_KEY` is added to the backend secrets, the housing search will automatically start working with no additional changes needed.
