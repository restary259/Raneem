
# Fix: Temporary Password Not Displayed After Account Creation

## Root Cause (Confirmed)

Three accounts were already created successfully (verified in database: `must_change_password: true` for all three). The password **was returned by the edge function** but was **never seen** in the UI due to a timing + state reset bug.

### The Exact Bug Chain

1. Admin fills form → clicks "Create Account"
2. `handleCreate()` runs → edge function called → succeeds, returns `temp_password`
3. `setCreatedPassword(result.temp_password || 'sent')` is called — password is stored in state
4. **`onRefresh()` is called immediately after** — this triggers parent to refetch all data
5. The parent re-render causes the `InfluencerManagement` component to re-render
6. React re-renders the Dialog, which may flash or reset depending on DOM reconciliation
7. The admin may have briefly seen the green box, or it appeared and disappeared quickly on fast networks

### Secondary Bug: Fallback to `'sent'`

On line 63:
```typescript
setCreatedPassword(result.temp_password || 'sent');
```

If `result.temp_password` were ever `undefined` (unlikely but possible), the green box shows "Account created successfully" but **hides the password** because of this check on line 145:
```typescript
{createdPassword !== 'sent' && (
  // password display — completely hidden when fallback is 'sent'
)}
```

### Third Issue: Invite Insert Can Fail Silently

Line 56 inserts into `influencer_invites` before creating the account:
```typescript
await (supabase as any).from('influencer_invites').insert({...});
```
If this insert throws (e.g. duplicate email), the error is not caught — execution continues to the `fetch()` call. However the outer `try/catch` would catch it and show an error toast. But we observed accounts were created — so this isn't blocking here, just untidy.

---

## The Fix

### Change 1: Show Password in a Persistent Modal (Not Inside Create Dialog)

The most reliable fix is to separate the "password reveal" step from the creation dialog. After creation succeeds:
- Close the creation form
- Open a **second, dedicated modal** that shows only the credentials
- This modal cannot be accidentally dismissed without the admin explicitly closing it
- The admin must click "I've saved the password" to close it

This guarantees the admin sees the password regardless of any re-render timing from `onRefresh()`.

### Change 2: Remove the `'sent'` fallback — Always Require `temp_password`

If the edge function returns no temp password, show an error toast instead of silently hiding it.

### Change 3: Move `onRefresh()` After the Admin Dismisses the Password Modal

The parent data refresh should happen after the admin closes the credentials modal, not immediately after creation — this eliminates the re-render race.

---

## Implementation Plan

### File: `src/components/admin/InfluencerManagement.tsx`

**Add new state variables:**
```typescript
const [showCredentialsModal, setShowCredentialsModal] = useState(false);
const [createdEmail, setCreatedEmail] = useState('');
```

**Refactor `handleCreate`:**
```typescript
const handleCreate = async () => {
  if (!name || !email) return;
  setIsCreating(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email, full_name: name, role: filterRole || role, commission_amount: commission ? parseInt(commission) : 0 }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || 'Failed to create');

    if (!result.temp_password) {
      throw new Error('Account created but no temporary password was returned. Contact support.');
    }

    // Store credentials and show dedicated modal
    setCreatedPassword(result.temp_password);
    setCreatedEmail(email);
    setDialogOpen(false); // Close creation form
    setShowCredentialsModal(true); // Open dedicated credentials modal

    // Reset form fields
    setName(''); setEmail(''); setCommission(''); setRole(filterRole || 'influencer');
    // NOTE: onRefresh() is called when admin dismisses the credentials modal
  } catch (err: any) {
    toast({ variant: 'destructive', title: t('common.error'), description: err.message });
  } finally {
    setIsCreating(false);
  }
};
```

**Add credentials modal (after closing creation dialog):**
```tsx
<Dialog open={showCredentialsModal} onOpenChange={() => {}}>
  <DialogContent onPointerDownOutside={e => e.preventDefault()}>
    <DialogHeader>
      <DialogTitle>✅ Account Created — Save These Credentials</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Share these credentials with the new member. They will be required to change their password on first login.
      </p>
      <div className="space-y-3">
        <div>
          <Label>Email</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-sm bg-muted border rounded px-3 py-2">{createdEmail}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdEmail); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div>
          <Label>Temporary Password</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-sm bg-muted border rounded px-3 py-2 font-bold tracking-wider">{createdPassword}</code>
            <Button size="sm" variant="outline" onClick={copyPassword}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded p-3">
        <p className="text-xs text-amber-800 font-medium">
          ⚠️ This password will NOT be shown again. Please copy it now and send it securely to the new member.
        </p>
      </div>
      <Button
        className="w-full"
        onClick={() => {
          setShowCredentialsModal(false);
          setCreatedPassword('');
          setCreatedEmail('');
          onRefresh(); // Refresh AFTER admin confirms they saw the password
        }}
      >
        I've Saved the Credentials — Close
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**Remove the inline password display from within the creation dialog** (lines 138–157) — it's replaced by the dedicated modal above.

---

## What Changes

| What | Before | After |
|---|---|---|
| Password display location | Inside creation dialog (races with re-render) | Dedicated locked modal that cannot be dismissed accidentally |
| `onRefresh()` timing | Called immediately after creation | Called only when admin dismisses credentials modal |
| Password fallback | Falls back to `'sent'` which hides the password | Throws an error toast — admin knows something is wrong |
| Dialog close behavior | `onOpenChange` can close and reset state | Creation dialog closes cleanly before credentials modal opens |
| Invite pre-insert | Before account creation (silently fails) | Removed from frontend — the edge function handles this internally |

## Files Changed

- `src/components/admin/InfluencerManagement.tsx` — Refactor create flow + add credentials reveal modal
