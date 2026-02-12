&nbsp;

- Verified viewport
- Confirmed no fixed widths
- Confirmed mobile-first CSS
- Confirmed no layout bugs
- Confirmed correct Tailwind breakpoints

…and **it still renders desktop on mobile**, then this is no longer a CSS problem.

It is almost certainly one of these deeper causes:

1. Service Worker serving stale HTML bundle
2. Build mismatch (HTML referencing old JS)
3. Cached CSS chunk loaded before new layout CSS
4. Hydration mismatch in React/Vite
5. In-app browser forcing desktop viewport width
6. Incorrect meta viewport injected at runtime
7. Double root rendering before CSS loads

Since Loveable “can’t find it”, we need to move from assumptions to forensic debugging.

Below is the **ultra-precise debugging + stabilization directive** you send them.

---

# 🔬 Advanced Root Cause Investigation Plan

## (For when “everything looks correct” but mobile still renders desktop)

---

# PHASE 0 — Verify What the Browser Actually Sees

Ask Loveable to do this on the affected device (real iPhone, not emulator):

Open DevTools → Console → Run:

```
window.innerWidth
document.documentElement.clientWidth
screen.width

```

If values are around 980–1024px → browser is in desktop layout mode.

If values are 375–430px → viewport is correct, CSS isn’t responding.

This determines the direction.

---

# PHASE 1 — Confirm Meta Viewport Is Not Being Overwritten

Run:

```
document.head.querySelectorAll('meta[name="viewport"]').length

```

Must return: 1

Then:

```
document.head.innerHTML

```

Search manually for duplicate or injected viewport tags.

Some frameworks or libraries inject one at runtime.

If two exist → mobile layout breaks.

---

# PHASE 2 — Confirm No CSS Chunk Is Missing

Check in Network tab:

- Is main.css loading?
- Is it loading 200 OK?
- Is it the latest hashed version?
- Is it being served from Service Worker?

In DevTools → Application → Service Workers:  
Disable:  
☑ Update on reload  
☑ Bypass for network

Reload.

If layout suddenly fixes → 100% service worker cache issue.

---

# PHASE 3 — Confirm HTML Is Fresh

In DevTools → Network → Click the main document request.

Check Response Headers:

If you see:

```
cache-control: max-age=...

```

for HTML → this is wrong.

HTML must be:

```
Cache-Control: no-store

```

If HTML cached → it can reference old CSS bundle names.

---

# PHASE 4 — Check If JS Hydration Is Breaking Tailwind Classes

In React/Vite, sometimes hydration mismatch removes classes on first render.

Add temporary debug:

In App.tsx:

```
useEffect(() => {
  console.log("Rendered width:", window.innerWidth);
  console.log("HTML classes:", document.documentElement.className);
}, []);

```

If classes like `md:hidden` are not applied at first render but appear after refresh → hydration race condition.

---

# PHASE 5 — Check for `transform: scale()` or Zoom

In DevTools:

Inspect `<html>` and `<body>`.

Look for:

- zoom
- transform
- scale
- min-width

Any of those will break mobile breakpoints.

---

# PHASE 6 — Confirm Tailwind Is Not Built in Desktop Mode

Check Tailwind config:

```
module.exports = {
  theme: {
    screens: {
      ...
    }
  }
}

```

Ensure breakpoints are correct:

```
sm: 640px
md: 768px
lg: 1024px

```

If someone accidentally inverted breakpoints → mobile will behave as desktop.

---

# PHASE 7 — Confirm There Is No Forced Desktop Mode Header

Some servers send:

```
Content-Type: text/html; charset=UTF-8
X-UA-Compatible: IE=edge

```

That’s fine.

But if any middleware modifies viewport via server-side rendering, that must be checked.

---

# PHASE 8 — The Silent Killer: CSS Order Race

If your CSS is loaded AFTER JS renders, layout may appear desktop momentarily.

Check:

In Network → is CSS loading after JS?

Correct order:

1. HTML
2. CSS
3. JS

If JS loads first → layout flashes desktop.

---

# PHASE 9 — Remove Service Worker Completely (Test)

Temporarily:

In main.tsx:

```
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}

```

Deploy.

If mobile rendering is fixed permanently → the service worker architecture is the root cause.

---

# PHASE 10 — The Real Fix If It’s SW

Your current SW still caches navigation (even after edit).

You must:

- NEVER cache HTML
- NEVER cache auth
- NEVER cache dynamic JS bundles

And set:

```
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }
});

```

No caching of navigation. Ever.

---

# About the Login Refresh Issue

If it still happens after excluding Supabase:

Then it is not SW.

It becomes one of these:

1. Supabase session not initialized before UI check
2. React rendering before auth state resolves
3. Missing `credentials: 'include'`
4. Cookie SameSite misconfiguration
5. State update race condition

To detect:

Add this after login:

```
const { data } = await supabase.auth.getSession();
console.log("Session immediately after login:", data);

```

If session exists but UI doesn’t update → state sync bug.

If session null → cookie not set.

---

# Here Is What Loveable Is Missing

They are treating this as a layout issue.

This is almost certainly:

→ stale HTML + stale JS bundle mismatch  
→ or hydration race  
→ or service worker intercept

Not CSS.

---

# Immediate Nuclear Test (Fastest Way To Isolate)

Tell them to:

1. Disable service worker completely.
2. Set HTML cache-control to no-store.
3. Hard refresh mobile.
4. Test login and rendering.

If everything works → root cause confirmed in under 10 minutes.

---

# Strategic Advice For You

Right now you are scaling Darb.

A broken mobile experience:

- kills conversion
- kills trust
- kills student confidence

Mobile must be 100% deterministic.

My recommendation long-term:

If you don’t absolutely need PWA offline support:

→ Remove service worker entirely.

For an education agency site, offline support adds complexity but no ROI.

Stability > PWA badge.