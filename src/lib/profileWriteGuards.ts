export function stripMustChangePassword<T extends Record<string, unknown>>(patch: T): Omit<T, "must_change_password"> {
  const next = { ...patch } as Record<string, unknown>;
  delete next["must_change_password"];
  return next as Omit<T, "must_change_password">;
}
