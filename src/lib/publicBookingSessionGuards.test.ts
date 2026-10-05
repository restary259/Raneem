import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the direct public booking entry point (`/book-appointment`).
 *
 * `create_public_booking_session` validates the applicant's phone before it
 * mints a booking token. A previous revision wrote the pattern as
 * `'^\\+?[0-9]{8,15}$'`. Under standard_conforming_strings=on (the default,
 * and what Supabase applies migrations in) that literal is a backslash followed
 * by `+?`, so the regex demanded a literal backslash and rejected every real
 * phone number — the entry point could never mint a token. The same
 * over-escaping bug class is already guarded for the referral migration in
 * `referralRegistrationGuards.test.ts`; this covers the booking RPC.
 */
const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

const migrationFiles = () =>
  readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();

const readMigration = (file: string) => readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");

/** SQL text with `--` comment lines removed, so quoted examples cannot match. */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const filesDefining = (fn: string) =>
  migrationFiles().filter((file) => readMigration(file).includes(`FUNCTION public.${fn}(`));

describe("public booking session phone validation", () => {
  const newestBookingMigration = () => {
    const defining = filesDefining("create_public_booking_session");
    expect(defining.length).toBeGreaterThan(0);
    const file = defining[defining.length - 1];
    return { file, code: stripComments(readMigration(file)) };
  };

  it("the newest create_public_booking_session uses a phone pattern that matches real numbers", () => {
    const { file, code } = newestBookingMigration();

    // A double backslash is a literal backslash in the pattern: reject it.
    expect(code, file).not.toContain("!~ '^\\\\+?[0-9]{8,15}$'");
    // The working form accepts the optional leading `+` for international input.
    expect(code, file).toContain("IF v_phone !~ '^\\+?[0-9]{8,15}$' THEN");
  });

  it("the deployed pattern accepts +, bare-international and local formats", () => {
    const { code } = newestBookingMigration();
    const match = /IF v_phone !~ '(\^[^']+\$)' THEN/.exec(code);
    expect(match, "phone pattern not found in executable SQL").not.toBeNull();

    // The captured source is a standard SQL literal, so `\+` is a literal `+`
    // to the regex engine. Postgres and JS agree on this simple pattern.
    const re = new RegExp(match![1]);
    expect(re.test("+972500000000")).toBe(true);
    expect(re.test("972500000000")).toBe(true);
    expect(re.test("0500000000")).toBe(true);
    expect(re.test("back\\slash")).toBe(false);
    expect(re.test("abc")).toBe(false);
  });
});
