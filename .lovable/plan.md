# Fix: apply page fails on submit

## Confirmed cause
When the student presses submit, the form sends the application to `https://undefined.supabase.co/...`. That address doesn't exist, so every submission fails.

The form builds this address from a project-ID setting (`VITE_SUPABASE_PROJECT_ID`). That setting is empty in the built app. The other two backend settings (URL and key) have build-time fallbacks in `vite.config.ts`, so they work. The project ID has no fallback.

## Fix
1. In `src/components/apply/ApplyForm.tsx` (line 235), build the address from the backend URL setting that already works: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-case-from-apply`.
2. Search the whole codebase for any other address built from the project ID. Right now `ApplyForm.tsx` is the only one found.

## Verify
- Submit a test application in the preview and confirm the request goes to the real backend and the success screen appears.
- Archive the test application afterward.
