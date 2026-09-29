import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const CASE_FINANCE = path.resolve(
  SRC_ROOT,
  "components",
  "cases",
  "CaseFinance.tsx",
);

/**
 * The Finance step collects NO payment proof: staff confirm the payment and the
 * server stamps the auto-generated case code as the payment reference. This
 * guard keeps the optional transfer-reference / receipt fields from creeping
 * back in (they were removed deliberately).
 */
describe("agency payment has no manual proof fields", () => {
  const source = fs.readFileSync(CASE_FINANCE, "utf8");

  it("calls confirm_agency_service_payment without p_reference / p_receipt_path", () => {
    expect(source).toContain('rpc("confirm_agency_service_payment"');
    expect(source).not.toMatch(/p_reference\s*:/);
    expect(source).not.toMatch(/p_receipt_path\s*:/);
  });

  it("has no transfer-reference or receipt inputs", () => {
    expect(source).not.toMatch(/transferReference/);
    expect(source).not.toMatch(/receiptFile/);
    expect(source).not.toMatch(/id="pm-ref"/);
    expect(source).not.toMatch(/id="pm-receipt"/);
  });

  it("no source file still imports the deleted proof helpers", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (
          /\.(ts|tsx)$/.test(entry.name) &&
          !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)
        ) {
          const text = fs.readFileSync(full, "utf8");
          if (/agencyPaymentProof|receiptStoragePath/.test(text))
            offenders.push(full);
        }
      }
    };
    walk(SRC_ROOT);
    expect(
      offenders,
      `Removed helpers are referenced again:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
