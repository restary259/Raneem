/**
 * Resolve which office a Google Business admin page should operate on.
 *
 * On a canonical office route (`/team/offices/:slug/google/*`) the workspace
 * header and URL are authoritative. If the signed-in operator has no Google
 * access for that office we must not silently fall back to another office —
 * doing so would read and write Google data for an office the page does not
 * name. On the legacy cross-office view we keep the conventional fallback:
 * the current selection, else the workspace selection if it is available,
 * else the first office.
 */
export function resolveGooglePageOffice({
  inOfficeWorkspace,
  effectiveOfficeId,
  officeIds,
  current,
}: {
  inOfficeWorkspace: boolean;
  effectiveOfficeId: string | null | undefined;
  officeIds: string[];
  current: string | null;
}): string | null {
  const isAvailable = (id: string | null | undefined): id is string =>
    !!id && officeIds.includes(id);

  if (inOfficeWorkspace) {
    return isAvailable(effectiveOfficeId) ? effectiveOfficeId : null;
  }
  if (current) return current;
  if (isAvailable(effectiveOfficeId)) return effectiveOfficeId;
  return officeIds[0] ?? null;
}
