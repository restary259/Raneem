
## Add Password Visibility Toggle to the Force-Password-Change Modal

### What's happening now
- **Student / Influencer / Team member** all share the same force-password modal in `src/pages/StudentAuthPage.tsx` (lines 243–252). It renders a plain `type="password"` input with **no eye toggle** — users cannot see what they're typing.
- **Admin** (`src/components/admin/AdminSecurityGate.tsx`) already has eye toggles on both fields — so admin is already fixed. ✅

### What to change — 1 file only

**`src/pages/StudentAuthPage.tsx`**

1. Add `showNewPw` boolean state (line ~26, alongside the existing `showPassword` state)
2. Wrap the password `<Input>` in a `relative` div and add the eye toggle button — identical pattern to what already exists in the same file for the login password field and in `AdminSecurityGate`
3. Update the import to include `Eye` and `EyeOff` from lucide-react — they're already imported on line 8 ✅

### Key change (lines 243–252):
```tsx
// Before:
<Input
  type="password"
  value={newPassword}
  onChange={(e) => setNewPassword(e.target.value)}
  placeholder={isRTL ? "أدخل كلمة مرور جديدة" : "Enter new password"}
/>

// After:
<div className="relative">
  <Input
    type={showNewPw ? "text" : "password"}
    value={newPassword}
    onChange={(e) => setNewPassword(e.target.value)}
    placeholder={isRTL ? "أدخل كلمة مرور جديدة" : "Enter new password"}
    className="pr-10"
  />
  <button
    type="button"
    onClick={() => setShowNewPw(v => !v)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
  >
    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
</div>
```

**1 file changed**: `src/pages/StudentAuthPage.tsx`  
**No backend changes needed.**
