import { describe, it, expect } from "vitest";
import { manualNextStages, stageBlockReason } from "./CaseStageService";

describe("stageBlockReason", () => {
  it("returns null while a manual forward move exists", () => {
    expect(stageBlockReason("new")).toBeNull();
    expect(manualNextStages("new")).toContain("contacted");
  });

  it("flags the final stage as terminal", () => {
    expect(stageBlockReason("enrollment_paid")).toEqual({ kind: "terminal" });
  });

  it("asks to reopen a cancelled case", () => {
    expect(stageBlockReason("cancelled")).toEqual({ kind: "inactive" });
  });

  it("treats a forgotten case as reopenable, not blocked", () => {
    // forgotten -> contacted is a manual edge, so the control stays enabled
    expect(stageBlockReason("forgotten")).toBeNull();
  });

  it("names the automated stage that comes next", () => {
    expect(stageBlockReason("profile_completion")).toEqual({
      kind: "automated",
      stage: "payment_confirmed",
    });
    expect(stageBlockReason("payment_confirmed")).toEqual({
      kind: "automated",
      stage: "submitted",
    });
    expect(stageBlockReason("submitted")).toEqual({
      kind: "automated",
      stage: "enrollment_paid",
    });
  });
});
