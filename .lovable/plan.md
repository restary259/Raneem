# DARB AI Assistant — Knowledge & Trust Rebuild

## What I found

The assistant is a single Supabase edge function, `ai-chat`, used by three surfaces: the floating chat widget, the `/ai-advisor` page, and the `/quiz` major-finder. It calls Lovable AI (`google/gemini-3-flash-preview`) with a **static, hardcoded Arabic knowledge block** pasted into four system prompts. There is no retrieval, no database lookup, no web access, and no citation logic anywhere in the flow.

Everything the assistant "knows" is that one text block — and it has drifted badly from the live site.

### Confirmed mismatches (current app vs. what the AI believes)

| Area | Live app | AI knowledge block |
|---|---|---|
| Major categories | 11 categories, 74 majors (`src/data/majorsData.ts`) | 9 categories, partial major lists — missing Agriculture & Environment and Tourism & Hospitality entirely |
| Universities | 20 universities + 3 language schools (`src/data/educationalDestinations.ts`) | 8 universities, with world-ranking numbers that are unsourced and stale |
| Bagrut admission | Authoritative anabin rule already written in the app: no official GPA threshold; requires Math 3 units, English 4 units, one more subject at 4 units | Claims medicine needs "a Bagrut average above 90" — a fabricated threshold that **contradicts the app's own sourced text** |
| Site pages | `/faq`, `/blog`, `/services`, `/apply`, `/quiz`, `/resources/lebenslauf-builder` all exist | None of these are known to the assistant |
| Hard figures | — | States a blocked-account amount and fixed application deadlines as permanent facts, with no source and no date |

### Other defects

- **No sources, ever.** The prompt never asks for a URL, so every external claim is unattributable.
- **No uncertainty rule that bites.** One soft line ("if unsure, say so") is outweighed by a knowledge block that reads as authoritative fact.
- **No response-length policy.** Every question gets the same essay-shaped answer.
- **Duplicate maintenance.** The same facts live in `majorsData.ts`, the destinations file, the FAQ locale files, and again in the prompt — four copies that drift independently.
- **Weak injection defence.** A six-regex denylist; trivially bypassed, and it also false-positives on legitimate questions.
- **Privacy note.** `ai_chat_logs` stores the first 100 characters of every user message. That is student-entered text and stays admin-readable.

---

## The plan

### 1. Delete the hardcoded knowledge block, build context at request time

Replace the pasted text with a context builder that assembles only what the current question needs:

- **Majors & categories** — derived from the live `majorsData.ts` dataset (shared into the function as generated JSON), not retyped. Only categories are always included; full major detail is injected only when the question names a field.
- **Universities & language schools** — from the live destinations dataset.
- **Site map** — the real current routes, so the assistant links to pages that exist.
- **Bagrut/anabin rule** — reuse the app's existing sourced note verbatim as the single source of truth. The invented "average above 90" claim is removed.

One authoritative copy per fact. When the app's dataset changes, the assistant changes with it.

### 2. DARB pricing: no numbers

Per your decision, the assistant explains what DARB offers and what the process looks like, then directs the student to contact DARB for a quote. It never states a service price, and it is explicitly told that any price figure it "remembers" is not trustworthy.

### 3. Hybrid web search for time-sensitive facts

Give the assistant a search tool it calls **only** when the answer depends on current external information — deadlines, tuition, admission requirements, visa rules, blocked-account amounts, programme availability. Stable DARB facts and general explanations are answered instantly with no search.

Rules enforced in the prompt and in the tool wiring:
- Prefer official sources: the university's own programme page, DAAD, uni-assist, anabin, ZAB, Hochschulkompass, German government sites.
- Cite the specific page that supports the claim, never a homepage and never an unrelated page from the same institution.
- Only URLs returned by the search tool may be cited. Constructing a plausible-looking URL is forbidden.
- If the search finds nothing solid, say so instead of answering.

### 4. Honesty rules that actually constrain

New prompt sections, written as hard rules rather than suggestions:

- Never invent a university, programme, requirement, grade threshold, price, deadline, scholarship, statistic, or URL. If unverified: *"I don't have a verified source for that — here's where to check."*
- Separate **eligibility** from **application** from **admission**. The Bagrut may qualify a student to apply; it never guarantees a place.
- Keep hedges intact: "may" stays "may", "often" stays "often", one university's rule is never generalised to Germany.
- Label DARB information as DARB's, and external information as external-and-sourced. Never blend them.

### 5. Length matched to the question

Short factual question → 1–3 sentences. Comparison → a handful of points plus a short conclusion. Complex guidance → structured walkthrough. Explicit request for a full guide → full depth. And in all cases: answer the question asked; no dumping unrelated DARB material.

### 6. Security pass

- Keep the system prompt server-side only (already true) and reinforce refusal to disclose it.
- Replace the brittle regex denylist with instruction-level defence plus a narrower filter, so real questions stop being rejected.
- Confirm no secrets, admin data, commission data, or other students' records can enter the AI context. The function is public/anon-facing, so it stays limited to public catalog and public content — no per-student record access is added.
- Reduce what `ai_chat_logs` retains so student-typed personal text is not stored longer than needed.
- No RLS changes.

### 7. Testing

Run a live test battery against the deployed function and report actual output:
- DARB facts: services, process, categories.
- Programme questions: duration, language, requirements.
- Israeli-student questions: Bagrut eligibility, Studienkolleg, German level.
- **Hallucination probes**: a university that doesn't exist, an invented scholarship, a made-up Bagrut cutoff, a fabricated deadline. The assistant must refuse each.
- **Source probes**: verify cited URLs resolve and actually discuss the claim.
- **Security probes**: attempts to extract the system prompt, keys, or other users' data.
- Plus `npm run build` and the vitest suite.

---

## Technical notes

- Changes are confined to `supabase/functions/ai-chat/` plus a small generated data module shared from `src/data/`. No UI redesign, no business-logic changes, no schema changes beyond log retention.
- The model id is checked against the current supported chat catalog and moved to the supported default if `google/gemini-3-flash-preview` is no longer listed.
- Prompt assembly is refactored so the Arabic, English, and quiz variants share one rule set instead of four drifting copies — this is what caused the divergence in the first place.
- Search is invoked through tool calling on the same gateway, so streaming to the UI is preserved and no new provider or key is introduced.

## Final report

I'll close with the full audit report you asked for: architecture, knowledge audit, source audit, hallucination audit, response-behaviour audit, security audit, changes made, real test results, remaining limitations, and a single verdict of PASS / PASS WITH LIMITATIONS / FAIL — based on tests actually executed, not assumed.
