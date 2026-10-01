import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_ROLES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_COLUMNS,
  categoriesForRole,
} from "./notificationCategories";
import type { AppRole } from "@/contexts/AuthContext";

/**
 * The category catalog is the single source of truth for the settings UI. These
 * tests keep it honest: every role sees only known categories, the Deno-side
 * mirror cannot drift, and every rendered label has translations.
 */

const ROOT = process.cwd();
const KNOWN_KEYS = NOTIFICATION_CATEGORIES.map((c) => c.key);
// Every locale the UI offers (src/i18n.ts supportedLngs). Hebrew falls back to
// English at runtime, so a missing key would silently render English — the
// guard below must fail instead, or the panel regresses one string at a time.
const PRIMARY_LOCALES = ["en", "ar", "he"] as const;

describe("notification category catalog", () => {
  it("uses unique keys and columns", () => {
    const keys = NOTIFICATION_CATEGORIES.map((c) => c.key);
    const columns = NOTIFICATION_CATEGORIES.map((c) => c.column);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(columns).size).toBe(columns.length);
    for (const column of columns) expect(column).toMatch(/^cat_[a-z_]+$/);
  });

  it("every role's list only uses known categories", () => {
    for (const role of ALL_ROLES) {
      for (const cat of categoriesForRole(role)) {
        expect(KNOWN_KEYS).toContain(cat.key);
        expect(cat.roles).toContain(role);
      }
    }
  });

  it("gives every role at least one category and no duplicates", () => {
    for (const role of ALL_ROLES) {
      const list = categoriesForRole(role);
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list.map((c) => c.key)).size).toBe(list.length);
    }
  });

  it("returns an empty list for an unknown/absent role", () => {
    expect(categoriesForRole(null)).toEqual([]);
    expect(categoriesForRole(undefined)).toEqual([]);
    expect(categoriesForRole("nobody" as AppRole)).toEqual([]);
  });

  /** The drift guard: the Deno mirror must expose the exact same mapping. */
  it("matches the backend mirror in supabase/functions/_shared", () => {
    const backend = fs.readFileSync(
      path.join(ROOT, "supabase/functions/_shared/notificationCategories.ts"),
      "utf8",
    );
    const pairs = [...backend.matchAll(/([a-z_]+):\s*"(cat_[a-z_]+)"/g)].map(
      (m) => [m[1], m[2]],
    ) as Array<[string, string]>;
    const backendColumns = Object.fromEntries(pairs);

    expect(backendColumns).toEqual(NOTIFICATION_CATEGORY_COLUMNS);
    expect(Object.keys(backendColumns).sort()).toEqual([...KNOWN_KEYS].sort());
  });

  /**
   * The backend producer: every category the SQL `notification_category_for_source`
   * can bucket a notification into must exist in the catalog, or the settings
   * UI would render a switch whose column nobody maps.
   */
  it("covers every category the SQL producer emits", () => {
    const migrationsDir = path.join(ROOT, "supabase/migrations");
    const producers = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
      .filter((s) =>
        s.includes("FUNCTION public.notification_category_for_source"),
      );
    expect(producers.length).toBeGreaterThan(0);

    // The newest definition (by migration order) is the live one. Read only the
    // function body: a migration file can hold other CASE...THEN literals (e.g.
    // the audit actor_role), which are not notification categories.
    const newest = producers[producers.length - 1];
    const body =
      newest.match(
        /FUNCTION public\.notification_category_for_source[\s\S]*?\$function\$([\s\S]*?)\$function\$/,
      )?.[1] ?? "";
    expect(body.length).toBeGreaterThan(0);
    const categories = new Set(
      [...body.matchAll(/THEN '([a-z_]+)'/g)].map((m) => m[1]),
    );
    expect(categories.size).toBeGreaterThan(0);
    for (const category of categories) {
      // 'system' is the ELSE/default bucket; everything else must be known.
      expect(
        KNOWN_KEYS,
        `SQL category '${category}' missing from catalog`,
      ).toContain(category);
    }
  });

  /**
   * Full key parity across offered locales. The runtime fallback
   * (`fallbackLng: { he: ['en'] }`) hides a missing key by rendering English, so
   * without this the panel quietly drifts out of sync one string at a time.
   */
  it("keeps every pushSettings key present in every locale", () => {
    const leafKeys = (node: unknown, prefix = ""): string[] => {
      if (typeof node !== "object" || node === null) return [prefix];
      return Object.entries(node as Record<string, unknown>).flatMap(
        ([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key),
      );
    };
    const read = (lang: string) =>
      JSON.parse(
        fs.readFileSync(
          path.join(ROOT, "public/locales", lang, "dashboard.json"),
          "utf8",
        ),
      ).pushSettings;

    const reference = leafKeys(read("en")).sort();
    expect(reference.length).toBeGreaterThan(0);
    for (const lang of PRIMARY_LOCALES) {
      expect(leafKeys(read(lang)).sort(), `${lang} pushSettings keys`).toEqual(
        reference,
      );
    }
  });

  it("renders only known categories in the settings component", () => {
    const src = fs.readFileSync(
      path.join(
        ROOT,
        "src/components/notifications/PushNotificationSettings.tsx",
      ),
      "utf8",
    );
    // The component must derive its switches from categoriesForRole(), never a
    // hardcoded list that could show a role a category it can't receive.
    expect(src).toContain("categoriesForRole(role)");
    expect(src).not.toMatch(/const CATEGORIES = \[/);
  });

  /**
   * Label coverage in every offered locale. `category`/`categoryDesc` are
   * mandatory (they are the fallback every role relies on); `categoryRole` and
   * `categoryRoleDesc` are optional overrides, but any that exist must be text.
   */
  it("has a translated label for every rendered role/category pair", () => {
    for (const lang of PRIMARY_LOCALES) {
      const dict = JSON.parse(
        fs.readFileSync(
          path.join(ROOT, "public/locales", lang, "dashboard.json"),
          "utf8",
        ),
      );
      const push = dict.pushSettings;
      expect(push, `${lang} pushSettings`).toBeDefined();
      for (const key of KNOWN_KEYS) {
        expect(
          push.category[key],
          `${lang} pushSettings.category.${key}`,
        ).toBeTruthy();
        expect(
          push.categoryDesc[key],
          `${lang} pushSettings.categoryDesc.${key}`,
        ).toBeTruthy();
      }
      for (const role of ALL_ROLES) {
        for (const cat of categoriesForRole(role)) {
          // A role-specific label/description is optional; the fallback is the
          // generic key above. Any that exist must be non-empty text.
          const label = push.categoryRole?.[role]?.[cat.key];
          const desc = push.categoryRoleDesc?.[role]?.[cat.key];
          if (label !== undefined) expect(label).toBeTruthy();
          if (desc !== undefined) expect(desc).toBeTruthy();
        }
      }
    }
  });
});
