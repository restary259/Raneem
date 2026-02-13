

# Uniplaces Housing Search Integration Plan

## Overview

Integrate the Uniplaces Open API to provide student accommodation search and booking capabilities. This adds a new "Housing" section where students can browse available apartments, filter by city/dates/budget, view details, and initiate bookings via Uniplaces.

---

## Architecture

The integration follows a secure proxy pattern:

```text
Browser --> Edge Function (uniplaces-proxy) --> Uniplaces Staging API
                                                 (x-api-key header)
```

All API calls go through a backend function that holds the API key as a secret. The frontend never touches the key.

---

## Phase 1: Backend (Edge Function + Secret)

### A. Store API Key

Request the `UNIPLACES_API_KEY` secret from the user via the secrets tool.

### B. Create `supabase/functions/uniplaces-proxy/index.ts`

A single edge function that proxies all Uniplaces endpoints:

- **GET /cities** -- Fetches available cities
- **GET /cities/{city}/offers** -- Search listings with filters (move-in, move-out, limit, page, budget, rent type)
- **GET /offers/{offerId}** -- Get full offer details (photos, pricing, availability rules, cancellation policy)
- **POST /calculate-pricing** -- Initiate booking (returns redirect URL to Uniplaces checkout)

The function will:
1. Accept `action` + parameters in the request body
2. Forward to the Uniplaces staging API at `https://api-export.staging-uniplaces.com`
3. Attach the `x-api-key` header from the secret
4. Return the JSON response

CORS headers included. `verify_jwt = false` in config.toml (public search, no auth needed for browsing).

### C. Register in `supabase/config.toml`

```toml
[functions.uniplaces-proxy]
verify_jwt = false
```

---

## Phase 2: Frontend -- New Housing Page

### A. Create `src/pages/HousingPage.tsx`

A new page at route `/housing` with:

1. **Hero Section** -- "Find Your Student Housing in Europe" with city selector
2. **Search Filters Sidebar/Bar** -- Move-in date, move-out date, budget range, rent type (entire/private/shared)
3. **Listing Grid** -- Cards showing property photo, title, price, location
4. **Pagination** -- Load more / page navigation (API limit: 50 per page)

### B. Create Housing Components

| Component | Purpose |
|-----------|---------|
| `src/components/housing/HousingHero.tsx` | Hero with city dropdown |
| `src/components/housing/HousingFilters.tsx` | Date pickers, budget slider, rent type toggle |
| `src/components/housing/HousingCard.tsx` | Property listing card with image, title, price, badges |
| `src/components/housing/HousingDetailModal.tsx` | Full offer details: photos carousel, availability, cancellation policy, booking CTA |
| `src/components/housing/HousingGrid.tsx` | Grid layout with loading skeletons |
| `src/components/housing/BookingButton.tsx` | Calls calculate-pricing and redirects to Uniplaces checkout |

### C. Image Rendering

Construct image URLs using the staging CDN pattern:
```
https://cdn-static.staging-uniplaces.com/property-photos/{hash}/{size}.jpg
```
Use `medium` for cards, `x-large` for detail modal.

### D. Data Mapping (from API response)

| UI Element | JSON Path |
|------------|-----------|
| Title | `attributes.accommodation_offer.title` |
| Price | `attributes.accommodation_offer.price.amount` (divide by 100 for EUR) |
| Photos | `attributes.accommodation_offer.photos[].hash` |
| City | from the search context |
| Rent Type | `attributes.accommodation_offer.rent_type` |

### E. Booking Flow

1. User clicks "Book Now" on a listing
2. Frontend calls the edge function with `action: "calculate-pricing"` + offer_id, move-in, move-out, guests
3. Edge function calls `POST /v1/calculate-pricing`
4. Returns a redirect URL
5. Frontend opens the Uniplaces checkout in a new tab

---

## Phase 3: Translations

Add keys to both `public/locales/en/common.json` and `public/locales/ar/common.json`:

```json
{
  "housing": {
    "title": "Student Housing",
    "heroTitle": "Find Your Student Accommodation",
    "heroSubtitle": "Browse verified apartments and rooms near your university",
    "filterMoveIn": "Move-in Date",
    "filterMoveOut": "Move-out Date",
    "filterBudget": "Budget",
    "filterRentType": "Room Type",
    "entirePlace": "Entire Place",
    "privateBedroom": "Private Bedroom",
    "sharedBedroom": "Shared Bedroom",
    "perMonth": "/month",
    "bookNow": "Book Now",
    "viewDetails": "View Details",
    "noResults": "No listings found for your criteria",
    "loading": "Loading listings...",
    "cancellationPolicy": "Cancellation Policy",
    "availability": "Availability",
    "poweredBy": "Powered by Uniplaces"
  }
}
```

---

## Phase 4: Route Registration

Add to `App.tsx`:
```typescript
const HousingPage = lazy(() => import('./pages/HousingPage'));
// ...
<Route path="/housing" element={<HousingPage />} />
```

Add a "Housing" link to the navigation (DesktopNav + MobileNav + BottomNav) -- placed AFTER existing items to preserve nav order as per custom rules.

---

## Phase 5: Webhook Handling (Future / Phase 2)

The PDF describes webhook setup for booking lifecycle tracking (requested, awaiting, accepted, paid, confirmed, rejected, etc.). This would require:

- A webhook receiver edge function
- A `bookings` database table to store booking states
- Dashboard integration to show booking status

This is deferred to a future phase since the initial integration focuses on search and booking initiation. The booking lifecycle is managed by Uniplaces itself.

---

## Important Notes

- **Staging API hours**: 06:30-20:30 Portugal Time, Mon-Fri only. Outside these hours the API returns errors. The UI should handle this gracefully with an informational message.
- **Price format**: API returns amounts in cents (e.g., 46000 = 460.00 EUR). Frontend must divide by 100.
- **Contract types**: fortnightly, monthly, daily/nightly -- display appropriately.
- **Navigation order**: The Housing link will be added after existing nav items, preserving current order.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/uniplaces-proxy/index.ts` | NEW -- API proxy |
| `supabase/config.toml` | Add function config |
| `src/pages/HousingPage.tsx` | NEW -- main page |
| `src/components/housing/HousingHero.tsx` | NEW |
| `src/components/housing/HousingFilters.tsx` | NEW |
| `src/components/housing/HousingCard.tsx` | NEW |
| `src/components/housing/HousingDetailModal.tsx` | NEW |
| `src/components/housing/HousingGrid.tsx` | NEW |
| `src/components/housing/BookingButton.tsx` | NEW |
| `src/App.tsx` | Add `/housing` route |
| `src/components/landing/DesktopNav.tsx` | Add Housing nav link |
| `src/components/landing/MobileNav.tsx` | Add Housing nav link |
| `src/components/common/BottomNav.tsx` | Add Housing nav link |
| `public/locales/en/common.json` | Add housing keys |
| `public/locales/ar/common.json` | Add housing keys |

---

## What Will NOT Change

- Navigation order of existing items, logo, student portal button
- Brand colors and design language
- Existing pages and components
- Database schema (no new tables in Phase 1)

