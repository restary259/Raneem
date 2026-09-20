# WhatsApp → DARB Identity Bridge — Mapping & Implementation Plan

Date: 2026-09-20
Branch: main

## 1. Business invariant

WhatsApp is a second entrance/channel into the existing DARB CRM, not a second people database.

Target lifecycle:

```
Instagram / Facebook / Website / Google / Referral / Existing student
                         ↓
                      WhatsApp
                         ↓
                 WhatsApp Inbox
                         ↓
                 Identity Resolution
                         ↓
                  Existing DARB Person
                         ↓
                    Lead / Case
```

The hard invariant is:

> One real person must not become multiple DARB people merely because they entered through WhatsApp.

## 2. Existing DARB identity graph

### profiles
- Auth/person record.
- Canonical phone field: `profiles.phone_number`.
- Can point to a case through `profiles.case_id` / `profiles.linked_case_id`.
- Student accounts may therefore already represent the person before WhatsApp arrives.

### leads
- CRM lead record.
- Canonical phone field: `leads.phone`.
- No direct FK to `cases` in the current schema.
- Historical data can contain multiple lead rows for the same phone.

### cases
- Active student/application case.
- Canonical phone field: `cases.phone_number`.
- Can point to the student account through `student_user_id`.
- Case is the strongest active operational anchor.

### WhatsApp
- `whatsapp_leads`: one WhatsApp contact per WhatsApp number.
- `whatsapp_conversations`: one conversation per WhatsApp lead.
- `whatsapp_messages`: durable message history.
- `linked_case_id`, `linked_lead_id`, `linked_profile_id`: bridge into the existing DARB graph.

## 3. Current inbound flow

1. WhatsApp gateway sends an event.
2. Service-role-only `whatsapp_ingest_event(jsonb)` validates delivery id.
3. Delivery ledger makes the delivery idempotent.
4. Inbound sender number is stored in `whatsapp_leads`.
5. Conversation is created/reused.
6. Message is inserted idempotently by provider message id.
7. Conversation unread/last-message state is updated.
8. Identity resolution now runs immediately after a newly stored inbound message.

Existing status/template/media handling remains intact.

## 4. Canonical phone policy

The identity bridge uses `whatsapp_identity_phone_key()`.

Normalization:
- strips formatting characters;
- converts `00...` to international digits;
- removes leading `+`;
- converts common Israeli local mobile format `05XXXXXXXX` to `9725XXXXXXXX`.

Automatic identity attachment uses the canonical key, not the old last-9-digit fuzzy comparison.

The old last-9-digit approach remains unsuitable for automatic merging because it can create cross-country collisions. It has therefore been removed from the suggestion RPC as well.

## 5. Automatic resolution rules

### A. Exactly one active case match
Automatically attach the WhatsApp contact to that case.

Also attach:
- the single matching profile when it belongs to that case/person;
- the single matching lead when present.

### B. No case, exactly one profile and/or one lead
Automatically attach to the unambiguous existing identity.

### C. Multiple cases
Do not choose one.

Result: `ambiguous`.

### D. Conflicting profiles
If profiles with the same phone are not all attached to the same case/person, do not choose one.

Result: `ambiguous`.

### E. Multiple legacy leads
Do not choose one.

Result: `ambiguous`.

### F. No DARB identity
Create a lightweight core `leads` row:
- `source_type = 'whatsapp'`
- `status = 'new'`
- phone = inbound WhatsApp number

Then link the WhatsApp contact to that new lead.

This is serialized by a transaction-scoped advisory lock on the canonical phone so concurrent inbound deliveries cannot create duplicate core leads.

## 6. Staff confirmation path

Staff identity suggestions remain available for ambiguous/unresolved contacts.

Manual linking now validates that every selected lead/case/profile has the same canonical phone as the WhatsApp number.

A client cannot submit unrelated IDs and create a cross-person link.

## 7. What this intentionally does NOT do

- It does not create a case merely because someone sends a WhatsApp message.
- It does not overwrite an existing confirmed WhatsApp identity.
- It does not merge duplicate DARB records automatically.
- It does not guess between multiple cases/profiles/leads.
- It does not move WhatsApp messages into the normal case chat system.
- It does not expose WhatsApp data to partners/ambassadors/students.
- It does not change existing referral/commission attribution.

## 8. End-to-end examples

### Existing student
```
Existing profile
Existing case
Existing lead
      +
WhatsApp message
      ↓
exact phone match
      ↓
same WhatsApp conversation
      ↓
profile + case + lead linked
```

### Existing lead, no case
```
Existing lead
      +
WhatsApp message
      ↓
exact unique phone
      ↓
same lead linked
      ↓
no case created automatically
```

### Brand-new WhatsApp person
```
WhatsApp message
      ↓
no case/profile/lead
      ↓
create core lead(source=whatsapp,status=new)
      ↓
link WhatsApp → lead
      ↓
normal DARB team pipeline takes over
```

### Ambiguous number
```
WhatsApp number
      ↓
2 active cases OR conflicting identities
      ↓
NO automatic link
      ↓
staff identity suggestions
      ↓
staff confirms the correct record
```

## 9. Safety / rollback

All changes are additive migrations.

Rollback strategy:
1. Disable/revert the final ingest function replacement.
2. Revert the bridge migrations.
3. Existing WhatsApp tables and historical messages remain intact.
4. No destructive merge/delete operation is performed by this feature.

## 10. Verification checklist

- [x] Existing WhatsApp ingest contract preserved.
- [x] Delivery idempotency preserved.
- [x] Provider message id idempotency preserved.
- [x] Template-status handling preserved.
- [x] Status ordering preserved.
- [x] Unknown event logging preserved.
- [x] Automatic exact identity resolution added.
- [x] Ambiguous identities remain unlinked.
- [x] Unknown contacts can enter the core lead pipeline.
- [x] Core lead creation is serialized per canonical phone.
- [x] Manual identity linking is phone-consistent.
- [ ] Run Supabase migration/type generation in the target environment.
- [ ] Execute database integration tests against a disposable/staging dataset.
- [ ] Verify one real inbound message for each of the four scenarios above.
