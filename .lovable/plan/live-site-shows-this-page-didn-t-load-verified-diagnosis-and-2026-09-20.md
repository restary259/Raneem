# Live site shows "This page didn't load" — verified diagnosis and fix

## What I verified (not assumed)

**1. The error page you see is the app's own fallback.** I fetched the live site and compared it byte-for-byte with the fallback page in the code. Identical. So the site is reachable, but the server fails on every request and falls back to that page.

```text
https://darb-agency.lovable.app/                            -> 500, fallback page
https://darb-agency.lovable.app/api/public/whatsapp/webhook -> 500, fallback page
```

**2. The current code is not broken.** I built the app exactly the way the live site is built, then ran that production build in the same server runtime the live site uses, and requested real pages:

```text
/                            -> 200, full page rendered
/team/messages               -> 200
/api/public/whatsapp/webhook -> 200 "DARB WhatsApp receiver is online"
```

So what is live is an older, broken deployment. The code in the project today works.

**3. One real packaging risk found while doing this.** The project is marked as "no side effects". The production bundler acted on that and reported dropping side-effect-only imports, including the one that arms the server's error capture and the server runtime init module. This is exactly the kind of difference that works in preview and fails only once deployed, so it should be corrected before republishing rather than left in place.

## Plan

1. **Remove the "no side effects" marking** from the project manifest so the production bundler stops discarding side-effect-only imports (error capture, runtime init, stylesheets). This is a one-line change and affects packaging only, no app behaviour.
2. **Rebuild and re-verify in the production runtime** locally: home page, a dashboard route, and the WhatsApp receiving address must all answer correctly, with no "ignoring this import" warnings left.
3. **Republish the app** so the live site serves this working build instead of the broken one.
4. **Re-check the live site after publishing**: home page loads, a dashboard route loads, and the WhatsApp receiving address answers "receiver is online". If anything still fails, read the deployment's server error and fix that specific error — no guessing.

## Why this also matters for WhatsApp

Incoming WhatsApp messages are delivered to the live address. While the live site answers with an error on every request, deliveries have nowhere to land — which matches the empty delivery and message tables. Getting the live site healthy is the prerequisite before the WhatsApp chain can be tested end to end.

## Technical notes

- Evidence for "current code is fine": `npm run build` succeeds (nitro `cloudflare-module` preset), and `wrangler dev dist/server/index.mjs --compatibility-flags nodejs_compat` serves `/`, `/team/messages` and the webhook route with 200s.
- The fallback HTML comes from `renderErrorPage()` in `src/lib/error-page.ts`, returned by the SSR wrapper in `src/server.ts` and the request middleware in `src/start.ts` — all five SSR error-handling layers are correctly wired, which is why the failure is visible as a branded page rather than a raw crash.
- The packaging fix is removing `"sideEffects": false` from `package.json`. Bundler evidence: `Ignoring this import because "dist/server/_runtime.mjs" was marked as having no side effects [ignored-bare-import]`, repeated across SSR chunks. `src/server.ts` opens with the side-effect-only `import "./lib/error-capture"`, which the same rule can drop.
- No database, access-rule, or WhatsApp-logic changes are part of this fix.
