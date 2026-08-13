import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Account identity resolution.
 *
 * DARB models one authentication identity = exactly one role. Email is an
 * attribute of an identity, never a relationship between accounts: we look it
 * up only so we can *block* a collision, never to silently reuse, merge or
 * overwrite somebody else's account.
 */
export type Identity = {
  exists: boolean;
  userId: string | null;
  role: string | null;
  deactivated: boolean;
  fullName: string | null;
};

export async function resolveIdentity(
  admin: SupabaseClient,
  rawEmail: string,
): Promise<Identity> {
  const email = rawEmail.trim().toLowerCase();
  const empty: Identity = {
    exists: false,
    userId: null,
    role: null,
    deactivated: false,
    fullName: null,
  };

  // Primary source is profiles (every auth identity gets a profile via the
  // on_auth_user_created trigger). Limit 2 so a duplicated profile row
  // (profiles.email has NO unique constraint) surfaces as ambiguous instead of
  // an unhandled maybeSingle() error.
  const { data: matches, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, deleted_at")
    .ilike("email", email)
    .limit(2);
  if (profileError) {
    console.error("resolveIdentity: profile lookup failed", { email, error: profileError });
  }

  let userId: string | null = null;
  let profile: { id: string; full_name: string | null; deleted_at: string | null } | undefined;

  if (matches && matches.length > 0) {
    if (matches.length > 1) {
      console.warn("resolveIdentity: multiple profiles share the same email", { email });
    }
    profile = matches[0];
    userId = profile.id;
  }

  if (!userId) {
    // No profile row — the identity may still exist in auth. Scan every page,
    // not just the first 1000 users.
    const perPage = 1000;
    let page = 1;
    while (page <= 10) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) {
        console.error("resolveIdentity: auth user lookup failed", { email, error: listError });
        break;
      }
      const users = list?.users ?? [];
      userId =
        users.find(
          (u: { email?: string; id: string }) => (u.email ?? "").toLowerCase() === email,
        )?.id ?? null;
      if (userId || users.length < perPage) break;
      page += 1;
    }
    if (!userId) return empty;
  }

  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(2);
  if (roleError) {
    console.error("resolveIdentity: role lookup failed", { userId, error: roleError });
  }

  return {
    exists: true,
    userId,
    role: (roleRows?.[0]?.role as string) ?? null,
    deactivated: Boolean(profile?.deleted_at),
    fullName: profile?.full_name ?? null,
  };
}

/**
 * Returns a 409 conflict payload when `email` already belongs to any identity,
 * or null when the email is free to use for a brand-new account.
 */
export async function identityConflict(
  admin: SupabaseClient,
  email: string,
  intendedRole: string,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const identity = await resolveIdentity(admin, email);
  if (!identity.exists) return null;

  return {
    status: 409,
    body: {
      error:
        identity.role === intendedRole
          ? "This email already has that role."
          : "This email already belongs to another account.",
      code: "identity_conflict",
      existing_role: identity.role,
      existing_user_id: identity.userId,
      deactivated: identity.deactivated,
      intended_role: intendedRole,
    },
  };
}
