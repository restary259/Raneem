import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const STUDENT_VISA = path.resolve(
  SRC_ROOT,
  "pages",
  "student",
  "StudentVisaPage.tsx",
);

/**
 * The student-side post-enrollment Visa workflow has three guardrails that are
 * easy to silently regress:
 *
 *  1. `visa_status` is Admin-controlled (the `visa_field_values` RLS policies
 *     reject any student write to it), so the student save must never include
 *     that field — upserting the whole field set made the entire save fail.
 *  2. The "Submit for Administration" action must exist and go through the
 *     security-definer RPC (a raw table write would bypass ownership,
 *     enrollment, arrival and required-field validation).
 *  3. Arrival confirmation must be reachable, because the submission RPC
 *     requires `arrived_in_germany_at`.
 */
describe("student visa workflow wiring", () => {
  const source = fs.readFileSync(STUDENT_VISA, "utf8");

  it("never writes visa_field_values (visa_status stays admin-controlled)", () => {
    expect(source).not.toMatch(/from\(["']visa_field_values["']\)[\s\S]{0,80}\.(insert|upsert|update)\(/);
  });

  it("always renders the student-keyed Visa Information form, with no duplicate legacy boxes", () => {
    expect(source).toContain("<VisaInfoWizard userId={userId} />");
    expect(source).not.toMatch(/caseId && userId \?/);
    expect(source).not.toContain("profile.legalSection");
    expect(source).not.toContain("const saveDynamic");
  });

  it("submits through the security-definer RPC", () => {
    expect(source).toContain("submitStudentVisaApplication(caseId)");
    // The submission must never be a direct table write.
    expect(source).not.toMatch(/from\(["']visa_applications["']\)\s*\.\s*(insert|upsert)/);
  });

  it("exposes arrival confirmation for the submission precondition", () => {
    expect(source).toContain("markOwnVisaArrived(caseId)");
  });

  it("gates the submit actions on enrollment", () => {
    expect(source).toMatch(/isEnrolled\s*=\s*caseStatus\s*===\s*"enrollment_paid"/);
    expect(source).toMatch(/\{isEnrolled && \(/);
  });

  it("keeps Visa out of the case status vocabulary", () => {
    const caseStatus = fs.readFileSync(
      path.resolve(SRC_ROOT, "lib", "caseStatus.ts"),
      "utf8",
    );
    expect(caseStatus).not.toMatch(/^\s*VISA\s*[:=]/m);
    expect(caseStatus).not.toMatch(/"visa"/);
  });
});
