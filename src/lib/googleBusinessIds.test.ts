import { describe, expect, it } from "vitest";
import { bareGoogleId, mediaPath, postsPath, reviewsPath, locationPath } from "./googleBusinessGateway";

describe("bareGoogleId", () => {
  it("accepts every stored format", () => {
    expect(bareGoogleId("123")).toBe("123");
    expect(bareGoogleId("accounts/123")).toBe("123");
    expect(bareGoogleId("locations/456")).toBe("456");
    expect(bareGoogleId("accounts/123/locations/456")).toBe("456");
  });
  it("never doubles the accounts/ prefix", () => {
    for (const p of [reviewsPath("accounts/1", "locations/2"), mediaPath("accounts/1", "2"), postsPath("accounts/1", "2")]) {
      expect(p).not.toContain("accounts/accounts");
      expect(p).toContain("/accounts/1/locations/2/");
    }
    expect(locationPath("accounts/1", "locations/2")).not.toContain("locations/locations");
  });
});
