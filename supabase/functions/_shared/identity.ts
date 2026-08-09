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

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, deleted_at")
    .ilike("email", email)
    .maybeSingle();

  let userId: string | null = profile?.id ?? null;

  if (!userId) {
    // No profile row — the identity may still exist in auth.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users?.find(
      (u: { email?: string; id: string }) => (u.email ?? "").toLowerCase() === email,
    )?.id ?? null;
    if (!userId) return empty;
  }

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    exists: true,
    userId,
    role: (roleRow?.role as string) ?? null,
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
