export function stripMustChangePassword<T extends Record<string, unknown>>(patch: T): Omit<T, "must_change_password"> {
  const { must_change_password: _ignored, ...rest } = patch as T & { must_change_password?: unknown };
  return rest;
}
