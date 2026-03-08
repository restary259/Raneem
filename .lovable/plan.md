
## What to Fix

The English `projMultiplier` translation key is missing the `{{paid}}` count variable. Arabic shows `"0 حالة مدفوعة × ₪800"` (correct, has the number) but English shows `"paid cases × ₪800"` (missing the number).

### File: `public/locales/en/dashboard.json`

Find the `projMultiplier` key and change:
```
"projMultiplier": "paid cases × ₪{{rate}}"
```
to:
```
"projMultiplier": "{{paid}} paid cases × ₪{{rate}}"
```

That's the only fix needed. One line, one file. No code changes, no DB changes.
