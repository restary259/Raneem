import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "@/lib/router-compat";
import { resolveOfficeSlug } from "@/lib/officeApi";
import type { MyGoogleOfficeRow } from "@/types/googleBusiness";

/**
 * Office workspace context.
 *
 * The office is the single parent context for appointments, applications,
 * team, and Google Business. These helpers resolve a slug → id, pick the
 * requested office out of a list, and build the canonical office-scoped URLs so
 * every surface (admin, team, Google sub-pages, deep links) agrees on one route
 * shape instead of each page inventing its own office selector.
 */

export type OfficeSurface = "admin" | "team";
export type GoogleTab =
  "" | "reviews" | "profile" | "photos" | "posts" | "insights";

/** `/team/offices/<slug>` or `/admin/offices/<slug>`. */
export function officeWorkspacePath(
  surface: OfficeSurface,
  slug: string,
): string {
  return `/${surface}/offices/${slug}`;
}

/** `/team/offices/<slug>/google/<tab>` (tab optional). */
export function officeGooglePath(
  surface: OfficeSurface,
  slug: string,
  tab: GoogleTab = "",
): string {
  const base = `${officeWorkspacePath(surface, slug)}/google`;
  return tab ? `${base}/${tab}` : base;
}

/** `/team/offices/<slug>/appointments`. */
export function officeAppointmentsPath(
  surface: OfficeSurface,
  slug: string,
): string {
  return `${officeWorkspacePath(surface, slug)}/appointments`;
}

/**
 * Picks the office to focus for a route. An explicit office id wins, then the
 * slug, otherwise fall back to the first office the caller may operate
 * (preserving the previous single-office behaviour).
 */
export function resolveActiveGoogleOffice(
  offices: MyGoogleOfficeRow[],
  opts: { officeId?: string | null; slug?: string | null } = {},
): MyGoogleOfficeRow | null {
  if (!offices.length) return null;
  if (opts.officeId) {
    const byId = offices.find((office) => office.office_id === opts.officeId);
    if (byId) return byId;
  }
  if (opts.slug) {
    const wanted = opts.slug.trim().toLowerCase();
    const match = offices.find(
      (office) => (office.office_slug ?? "").toLowerCase() === wanted,
    );
    if (match) return match;
  }
  return offices[0] ?? null;
}

/** Parses `slug`/`office` from a URLSearchParams-backed query. */
export function officeSlugFromParams(
  params: Pick<URLSearchParams, "get">,
): string | null {
  const raw = params.get("office") ?? params.get("slug");
  const clean = raw?.trim().toLowerCase();
  return clean ? clean : null;
}

/**
 * Resolves the office a Google page should focus from the URL.
 *
 * On the canonical office routes the slug is a route param
 * (`/team/offices/$slug/google/...`). On the legacy `/team/google?office=slug`
 * routes it arrives as a search param. Either way the slug is resolved
 * server-side to an id; callers still verify the id is in their
 * `listMyGoogleOffices()` set before using it.
 */
export function useOfficeWorkspaceSelection(): {
  slug: string | null;
  officeId: string | null;
} {
  const params = useParams<{ slug?: string; officeId?: string }>();
  const [searchParams] = useSearchParams();
  const slug = useMemo(() => {
    // Canonical office routes use `$officeId` to carry the *slug*; the older
    // Google routes used `$slug`. Legacy query-param callers add `?office=`.
    const fromPath = (params.slug ?? params.officeId)?.trim().toLowerCase();
    if (fromPath) return fromPath;
    return officeSlugFromParams(searchParams);
  }, [params.slug, params.officeId, searchParams]);

  const [officeId, setOfficeId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setOfficeId(null);
    if (!slug) return () => undefined;
    resolveOfficeSlug(slug)
      .then(({ data }) => {
        if (!cancelled) setOfficeId(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setOfficeId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { slug, officeId };
}
