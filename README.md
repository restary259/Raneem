# درب التعليمية — Darb Agency

Study-in-Germany guidance platform for Arabic-speaking students, plus the
internal admin / team / partner / student dashboards.

**Production site**: https://darb.agency

## Tech stack

- Vite
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (database, auth, storage, edge functions)

## Local development

Requires Node.js and npm.

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm i
npm run dev
```

## Tests

```sh
npm run test        # unit tests (Vitest)
npx playwright test # end-to-end tests
```

## Custom domain

The site is served from `darb.agency`. All canonical URLs, sitemap entries,
email links, and structured data must use that origin.
