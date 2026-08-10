import { describe, it, expect } from "vitest";
import { resolvePackageMode } from "./CaseServices";

describe("resolvePackageMode", () => {
  it("keeps an explicitly picked mode", () => {
    expect(resolvePackageMode("full_service", true, 3)).toBe("full_service");
    expect(resolvePackageMode("custom", true, 3)).toBe("custom");
    expect(resolvePackageMode("custom", false, 0)).toBe("custom");
  });

  it("derives full_service on load when the saved selection matches the bundle", () => {
    // packageMode starts empty (user has not re-picked) but the saved services
    // already equal the Full Service bundle → must render the full list.
    expect(resolvePackageMode("", true, 4)).toBe("full_service");
  });

  it("derives custom on load when saved services are not the bundle", () => {
    expect(resolvePackageMode("", false, 2)).toBe("custom");
  });

  it("stays empty when nothing is selected yet", () => {
    expect(resolvePackageMode("", false, 0)).toBe("");
  });
});
