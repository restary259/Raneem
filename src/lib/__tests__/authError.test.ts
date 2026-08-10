import { describe, expect, it } from "vitest";
import { AuthError } from "@supabase/supabase-js";
import { friendlyAuthError } from "@/lib/authError";

describe("friendlyAuthError", () => {
  it("maps known GoTrue error codes to friendly messages", () => {
    expect(friendlyAuthError(new AuthError("Password should be at least 6 characters", 422, "weak_password"))).toBe(
      "Your new password is too weak. Please choose a stronger one.",
    );
    expect(
      friendlyAuthError(
        new AuthError("New password should be different from the old password", 422, "same_password"),
      ),
    ).toBe("Your new password must be different from the old one.");
    expect(
      friendlyAuthError(new AuthError("Email rate limit exceeded", 429, "over_email_send_rate_limit")),
    ).toBe("Too many requests. Please wait a minute and try again.");
  });

  it("recognises raw message patterns even without a code", () => {
    expect(friendlyAuthError(new Error("User already registered"))).toBe("This email is already registered.");
    expect(friendlyAuthError(new Error("Email rate limit exceeded"))).toBe(
      "Too many requests. Please wait a minute and try again.",
    );
    expect(friendlyAuthError(new Error("Invalid login credentials"))).toBe(
      "The email or password you entered is incorrect.",
    );
    expect(friendlyAuthError(new Error("Failed to fetch"))).toBe(
      "Connection problem. Please check your internet and try again.",
    );
  });

  it("never leaks the raw message for unknown errors", () => {
    const err = new Error("new row violates row-level security policy for table public.cases");
    expect(friendlyAuthError(err)).toBe("Something went wrong. Please try again.");
    expect(friendlyAuthError(err)).not.toContain("row-level security");
  });

  it("handles non-Error values gracefully", () => {
    expect(friendlyAuthError(undefined)).toBe("Something went wrong. Please try again.");
    expect(friendlyAuthError("some string")).toBe("Something went wrong. Please try again.");
  });
});
