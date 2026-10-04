import { describe, expect, it } from "vitest";
import errorMessage, { errorMessage as named } from "./errorMessage";

describe("errorMessage", () => {
  it("returns the message of a real Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns the message of a PostgrestError-shaped object", () => {
    expect(
      errorMessage({ message: "duplicate key value", code: "23505" }),
    ).toBe("duplicate key value");
  });

  it("never renders a plain object as [object Object]", () => {
    expect(errorMessage({ code: "23505" })).toBe("[object Object]");
    expect(errorMessage({ message: 42 })).toBe("[object Object]");
  });

  it("stringifies primitives and nullish values", () => {
    expect(errorMessage("plain string")).toBe("plain string");
    expect(errorMessage(404)).toBe("404");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });

  it("is also the default export", () => {
    expect(errorMessage).toBe(named);
  });
});
