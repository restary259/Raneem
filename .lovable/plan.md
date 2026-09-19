# Move DARB to TanStack Start

Goal: the same DARB app, same look, same pages, same permissions — running on the
framework Lovable needs so this project can receive WhatsApp messages directly.

This is a framework change, not a redesign and not a rewrite. Pages, business
rules, the database, and all access rules stay exactly as they are.

## Decisions already taken

- Use Lovable's supported migration path (it also moves the app to the newer
  React and the newer styling engine).
- Publish on Lovable hosting after the migration.
- Keep the install-to-home-screen behaviour; drop offline browsing.

## What the app looks like today

- 97 pages wired up in one central file, 77 files using the current navigation
  library.
- Public site, plus Admin, Team, Partner, Agent and Student areas, each with its
  own access rules.
- Arabic (right-to-left) and English.
- Hand-written offline worker, custom security headers and page-routing rules on
  the current host, and a tuned way of splitting the app into download chunks.

## How this will run

### Step 1 — Safety record

Note the current commit, dependency versions, and the result of the build, the
tests and the code check. Write a full list of every page address, every
redirect, and every place the app navigates between pages. Nothing changes yet.

### Step 2 — Framework swap

Run the supported migration. It replaces the framework wiring files, moves the
app to the newer React and styling engine, and removes the old start-up files.
Immediately after, re-apply everything it overwrote: the DARB colours, fonts and
custom style rules; the download-chunk tuning; and the security headers and
locale file rule that currently live in the host config, re-created in app code.

### Step 3 — Pages

Create one thin wrapper per page address, pointing at the existing page
components. Existing pages are not rewritten. Dashboard areas keep their current
shells, so Admin, Team, Partner, Agent and Student layouts stay as they are, and
every current address and redirect keeps working, including
`/student-dashboard` going to the student checklist.

### Step 4 — Sign-in and permissions

Keep the current sign-in, session handling, password reset, account activation
and the onboarding gate. Roles stay exactly as they are — no new role, no change
to who can see what. Dashboard pages stay protected in the browser, so no private
student information is ever rendered into a public page response.

### Step 5 — Database, WhatsApp and the rest

No database change, no change to access rules, no change to the server-side
functions. The WhatsApp inbox, leads, conversations, templates, staff
assignment, human takeover and the AI draft helper all stay as they are: Admin
manages templates, Team may only send approved ones, the 24-hour rule stands, and
AI text is never sent automatically.

### Step 6 — Language, offline and global widgets

Arabic/English switching and right-to-left must work without a flash of the wrong
direction. The old offline worker is replaced with a small file that retires
itself, so returning visitors get the new app on their next online visit; the
install prompt, icons and app manifest stay. Toasts, tooltips, bottom
navigation, the WhatsApp button, the cookie notice, the offline indicator and
the install prompt all stay in place.

### Step 7 — Checks

Run the build, the code check, the unit tests and the browser tests. Then walk
the pages by hand in both languages: public pages, sign-in and sign-out, each
dashboard area, direct links, refresh, back and forward, mobile and desktop
navigation, live updates, and file uploads.

### Step 8 — WhatsApp receiving

Once the migrated app is stable, connect WhatsApp receiving to this project and
confirm a real inbound message reaches the Team inbox, matches an existing
contact when the number is known, updates the unread count live, and is not
duplicated when the same event arrives twice.

## Technical notes

- Framework: `@tanstack/react-start` + `@tanstack/react-router`, file-based
  routes under `src/routes/` as thin wrappers over `src/pages/`. React Query
  stays, with its current defaults ported into the new router setup.
- High-risk files: `package.json`, `vite.config.ts` (custom `manualChunks`),
  `tsconfig*.json`, `src/main.tsx`, `src/App.tsx`, `src/index.css`,
  `index.html`, `vercel.json`, `public/service-worker.js`.
- `index.html` head content, the head scripts and `src/main.tsx` start-up code
  move into the new root route's head and start-up setup; the CSP, HSTS and cache headers
  from `vercel.json` are re-created in app code.
- Browser-only code (`window`, `document`, `localStorage`, service worker,
  notifications, file/blob handling) must be guarded so it does not run during
  server rendering. Known spots: `src/i18n.ts`, `src/utils/export/index.ts`,
  `src/utils/pwaUtils.ts`.
- The Supabase browser client, generated types, realtime subscriptions, security
  definer functions and edge functions are untouched. No schema migration, no
  policy change, no service key in browser code.
- Expect a wave of type errors from the stricter settings and the React/styling
  upgrade; these are fixed in place, not silenced.

## Known risks

- The styling engine upgrade can shift spacing, shadows, rounding and ring
  widths. Each area gets a visual pass in both languages.
- Returning visitors with the old offline worker only update on their next
  online visit.
- Offline browsing is gone until it is rebuilt as a separate task.
- The work stays on a migration branch; if it turns unstable, the phase that
  broke is fixed rather than rolling back to the old framework.

## Done when

The app runs on the new framework, every current address works, roles behave
identically, database and live updates work, install behaviour works, Arabic and
English both render correctly, the WhatsApp inbox works, WhatsApp receiving can
be pointed at this project, and build, code check, unit tests and browser tests
all pass.
