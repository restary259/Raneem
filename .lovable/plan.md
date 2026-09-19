# Complete the WhatsApp Lead Workspace

## Goal
Finish the existing staff-only WhatsApp workspace so it covers the full lead profile, safe native outbound messaging, approved templates, and hardened AI drafting without changing the public product.

## What will change
- Complete the lead profile with budget, intended start date, language level, source, consent, and editable tags.
- Keep the existing lowercase database values and map them consistently to bilingual display labels.
- Add a secured staff-only server function for native WhatsApp sends through the authorized connector.
- Allow free-form replies only inside WhatsApp’s 24-hour service window.
- Outside that window, allow only an approved provider template and validate its required parameters before sending.
- Store accepted outbound messages and provider message IDs in the staff-only conversation history; preserve provider errors for staff.
- Sync provider templates into the protected template table and show their real approval state. Template creation remains provider-reviewed and cannot be treated as immediately usable.
- Harden AI drafts against prompt injection, add staff rate limiting, keep `openai/gpt-6-astra`, and preserve draft-only human review.
- Replace the custom reply box with the installed AI Elements prompt input while retaining the current DARB dashboard styling.
- Improve real-time refresh scope so new messages do not repeatedly reload staff and template data.

## Constraints
- No custom Meta credentials or direct Meta API calls; use only the linked native connector.
- No inbound-message claims: this project type cannot receive incoming WhatsApp messages, so the inbox remains honest until that capability exists.
- No automated sending, pricing/acceptance/timeline promises, or legal/visa advice from AI.
- Admin and team-member access only; provider-controlled message/template writes remain server-side.
- Existing public pages and consultancy workflows remain unchanged.

## Verification
- Typecheck and focused policy tests.
- Full project test command and preview build log.
- Live read-only connector checks for phone/template state.
- Staff route checks on desktop and mobile, including RTL layout and the 24-hour/template boundary.
