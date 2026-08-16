import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = join(process.cwd(), "src", "data", "schoolCatalog");
const schools = JSON.parse(readFileSync(join(base, "schools.json"), "utf8"));
const programs = JSON.parse(readFileSync(join(base, "programs.json"), "utf8"));
const accoms = JSON.parse(readFileSync(join(base, "accommodations.json"), "utf8"));
const insurances = JSON.parse(readFileSync(join(base, "insurances.json"), "utf8"));

const esc = (v) =>
  v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

const arr = (list) =>
  list && list.length ? `ARRAY[${list.map((x) => esc(x)).join(", ")}]` : `'{}'::text[]`;

const json = (obj) =>
  `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;

const tiersJson = (tiers) => json(tiers);

const schoolId = (slug) => `(SELECT id FROM public.schools WHERE slug = ${esc(slug)})`;

const out = [];
out.push(`-- ============================================================
-- School catalog seed: photos columns + scraped catalog data
--
-- Adds a \`photos text[]\` column to schools / programs / insurances
-- (accommodations already has it) and seeds the real catalog data
-- scraped from the four partner schools (F+U Academy, Alpha Aktiv,
-- GoAcademy!, KAPITO).
--
-- Idempotent: every INSERT guards on a name/slug match (ON CONFLICT or
-- WHERE NOT EXISTS), so re-running after a db reset is safe. Schools are
-- keyed by a stable \`slug\` column; programs/accommodations resolve the
-- school FK from the slug.
-- ============================================================

-- ── 1. photos columns ────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE public.insurances
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

-- ── 2. schools ───────────────────────────────────────────────────────
`);

for (const s of schools) {
  out.push(`INSERT INTO public.schools (slug, name_ar, name_en, city, country, website, description_ar, description_en, photos, is_active)
SELECT ${esc(s.slug)}, ${esc(s.name_ar)}, ${esc(s.name_en)}, ${esc(s.city)}, ${esc(s.country)}, ${esc(s.website)}, ${esc(s.description_ar)}, ${esc(s.description_en)}, ${arr(s.photos)}, ${s.is_active}
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = ${esc(s.slug)});
`);
}

out.push(`-- ── 3. programs ──────────────────────────────────────────────────────
`);

for (const p of programs) {
  out.push(`INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT ${schoolId(p.school)}, ${esc(p.name_ar)}, ${esc(p.name_en)}, ${esc(p.type)}, ${p.price ?? "NULL"}, ${esc(p.currency)}, ${esc(p.duration)}, ${esc(p.description_en)}, ${esc(p.description_ar)}, ${esc(p.description_en)}, ${esc(p.cefr_range)}, ${p.hours_per_week ?? "NULL"}, ${p.lessons_per_week ?? "NULL"}, ${esc(p.start_rule)}, ${p.registration_fee ?? "NULL"}, ${tiersJson(p.price_tiers)}, ${arr(p.photos)}, ${p.is_active}
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = ${schoolId(p.school)} AND name_en = ${esc(p.name_en)} AND duration = ${esc(p.duration)}
);
`);
}

out.push(`-- ── 4. accommodations ───────────────────────────────────────────────
`);

for (const a of accoms) {
  out.push(`INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT ${schoolId(a.school)}, ${esc(a.name_ar)}, ${esc(a.name_en)}, ${esc(a.room_type)}, ${esc(a.meals)}, ${a.price ?? "NULL"}, ${esc(a.currency)}, ${esc(a.distance_note)}, ${a.deposit ?? "NULL"}, ${a.placement_fee ?? "NULL"}, ${esc(a.description_en)}, ${esc(a.description_ar)}, ${esc(a.description_en)}, ${tiersJson(a.price_tiers)}, ${arr(a.photos)}, ${a.is_active}
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = ${schoolId(a.school)} AND name_en = ${esc(a.name_en)}
);
`);
}

out.push(`-- ── 5. insurances ──────────────────────────────────────────────────
`);

for (const i of insurances) {
  out.push(`INSERT INTO public.insurances (name, tier, billing_period, price, currency, provider, coverage_scope, max_age, min_months, max_months, description_ar, description_en, terms_url, is_active)
SELECT ${esc(i.name)}, ${esc(i.tier)}, ${esc(i.billing_period)}, ${i.price ?? "NULL"}, ${esc(i.currency)}, ${esc(i.provider)}, ${esc(i.coverage_scope)}, ${i.max_age ?? "NULL"}, ${i.min_months ?? "NULL"}, ${i.max_months ?? "NULL"}, ${esc(i.description_ar)}, ${esc(i.description_en)}, ${esc(i.terms_url)}, ${i.is_active}
WHERE NOT EXISTS (SELECT 1 FROM public.insurances WHERE name = ${esc(i.name)});
`);
}

out.push(`
-- ── 6. index for slug lookup ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schools_slug ON public.schools (slug);
`);

const dest = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260820000000_school_catalog_seed.sql",
);
writeFileSync(dest, out.join("\n"), "utf8");
console.log("wrote", dest, "-", out.join("\n").length, "bytes");