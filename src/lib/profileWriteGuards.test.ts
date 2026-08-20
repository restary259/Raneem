import { describe, expect, it } from "vitest";
import { stripMustChangePassword } from "./profileWriteGuards";

describe("stripMustChangePassword", () => {
  it("removes must_change_password from patch objects", () => {
    const result = stripMustChangePassword({
      phone_number: "+972123",
      must_change_password: true,
      city: "Haifa",
    });

    expect(result).toEqual({
      phone_number: "+972123",
      city: "Haifa",
    });
    expect("must_change_password" in result).toBe(false);
  });

  it("keeps payload unchanged when field is absent", () => {
    const result = stripMustChangePassword({
      notify_in_app: true,
      notify_email: false,
    });

    expect(result).toEqual({
      notify_in_app: true,
      notify_email: false,
    });
  });
});
