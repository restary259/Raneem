
## Root Cause (Confirmed)

Lines 274–285 each contain a **complete valid object** followed by duplicate orphaned field content outside the closing `}`. Example on line 274:

```
{ id: 'computer-engineering', ..., arab48NotesEN: '...' }, detailedDescription: '...', ...SAME FIELDS AGAIN..., arab48NotesEN: '...' },
```

This happened because a previous `code--write` with `// ... keep existing code` preserved the original entries and also appended the new replacement entries right after, doubling every engineering sub-major line.

## Fix

Overwrite the entire `engineering-technology` category block (lines 269–295) with clean, deduplicated entries. Each sub-major object appears exactly once per line. No other parts of the file are touched.

**Lines to replace:** 269–295  
**Strategy:** Write the clean engineering category from scratch — one object per line, no duplicates, with all the correct audit fixes already in place (6–7 semesters duration, ESA ESOC correction for space-engineering).

**No other file changes needed.** The rest of the file (lines 1–268 and 296–403) is intact and correct.
