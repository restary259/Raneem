# Partnership inbox, login polish, and content cleanup

## 1. Where partnership applications go (the real gap)

Today a partnership submission is saved to the `contact_submissions` table, but:

- Nothing in the admin dashboard displays that table. A `ContactsManager` component exists in the codebase but is not linked to any admin page or route — so applications are invisible.
- No email is ever sent. The `send-email` backend function only writes another row to the same table; it has no mail sending in it. It also causes a **duplicate row** for every partnership submission (the form saves once, the function saves again).

Fix:

- Add an **Applications / Inbox** page to the admin dashboard (sidebar entry + route), listing all submissions from the partnership form and the contact form: name, email, phone, source (partnership vs contact), date, status badge, and the full answers expanded on click. Search, mark as read/replied, and delete. Reuse the existing `ContactsManager` component, wired to live data with a "new" counter badge.
- Stop the duplicate insert so each application appears once.
- Email notification to `darbsocial27@gmail.com`: sending mail requires a verified sender domain on a domain you own (Gmail cannot be a sender). If you want the email alert, I will set up the sender domain for `darb.agency` and then send a notification on every new application. The admin inbox works immediately regardless.

## 2. Login page redesign

Rebuild the sign-in screen (the one in the screenshot) with the site's own visual language instead of the plain default card: brand logo/wordmark at the top, a warmer two-tone background, a wider card with clearer heading and supporting line, better field spacing and focus states, properly aligned RTL labels and the "forgot password" link, a full-width primary button with a loading state, and a cleaner "back to main website" link. Mobile-first, light mode only, semantic tokens only.

## 3. Remove the WhatsApp group prompt on Apply

On the Apply success screen, remove the "join the WhatsApp group" button and the automatic redirect that opens the group 5 seconds after submitting. The rest of the success screen stays.

## 4. Remove the fake testimonials

Remove the testimonials section ("اكتشف تجارب طلابنا الناجحة...") with the three placeholder reviews from the Services page — the component and its translation entries — so nothing fake ships. Real reviews can be added later.

## Technical notes

- New admin route (e.g. `/admin/inbox`) registered in `App.tsx`, added to the admin sidebar, gated by the existing admin protection.
- `contact_submissions` already has admin-only read access; no schema change needed unless we add the email notification, which would need the sender domain setup first.
- Remove the redundant insert in the partnership form path (keep exactly one write).
- Testimonials removal: delete `src/components/services/TestimonialSection.tsx`, its usage on the Services page, and the `testimonialSection` keys in the Arabic and English `services.json`.
- Apply page: drop the `setTimeout` group redirect and the WhatsApp anchor in the success block.
