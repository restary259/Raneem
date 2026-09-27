# Fix the Admin "Offices" page

## What's wrong (confirmed)

1. **The page crashes ("This section encountered a problem").** The Offices address doesn't open the Offices screen. It opens a *second copy of the whole dashboard frame* inside the first one. Each frame starts its own live unread-badge listener with the same name. The second one tries to attach to a listener that's already running, and that produces the exact error you saw (`cannot add postgres_changes callbacks for realtime:app-badge-notifications…`).
2. **The Offices screen is never shown, even without the crash.** The inner frame has nothing inside it, so the Offices management screen (list, add, edit, hours, routing) never appears. Every other admin page plugs its screen in directly. Offices is the only one that doesn't.
3. **The office data doesn't exist in the live database.** The four office setup files are in the project but were never applied. The tables for offices, office members, hours, routing rules and booking settings are missing, and so are the "save office" and "list team members" actions. Even after fixes 1 and 2, the page would show "Failed to load offices".
4. **The badge listener is fragile.** It reuses a fixed channel name and removes the old channel without waiting. A quick remount or a reconnect retry can hit the same crash in other places.

## Fixes

1. Point the Offices address at the Offices screen directly, the same way Members works. Drop the extra frame.
2. Make the badge listener safe to mount twice: use a unique channel name per mount (or reuse the shared pooled listener already in the app), and wait for the old channel to close before retrying.
3. Apply the four office database setup files, in order, through a database migration. Then confirm the tables, permissions (admin-only writes) and the two actions exist.
4. Smaller clean-ups on the page:
   - The "primary and backup can't be the same person" check shows the wrong message ("select a primary member first"). Give it its own message.
   - The success toast says just "Save". Change it to "Office saved".
   - Page text is hardcoded per language inside the file. Move it into the translation files (Arabic, English, Hebrew) as the project rules require.

## Verification
- Open Admin → Offices: no crash, and the list appears.
- Add an office, edit its hours and primary member, save, reload, and check the changes stayed.
- Try saving with booking turned on but no primary member: you should be blocked.
- Check that the unread badge still updates, and that no errors appear in the console.

## Technical notes
- `src/routes/admin.offices.tsx`: `component: AdminOfficesPage` (the parent `admin.tsx` already renders `DashboardLayout` + `ProtectedRoute`).
- `src/hooks/useAppBadge.ts`: suffix the topic with a per-mount id, or move it onto `subscribeTables` from `realtimeRegistry`; `await supabase.removeChannel` before re-subscribing.
- Migrations to apply: `20260927141500_multi_office_routing`, `20260927160000_multi_office_runtime_hardening`, `20260927180000_office_admin_and_realtime_hardening`, `20260927180001_office_admin_compatibility`. Review their GRANTs and RLS before applying.
- Once types regenerate, remove the `as any` casts on the office queries.
