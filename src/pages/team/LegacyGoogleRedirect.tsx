import { useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import {
  officeGooglePath,
  officeSlugFromParams,
  type GoogleTab,
} from "@/lib/officeWorkspace";

/**
 * Bridges the pre-office Google routes (`/team/google/reviews?office=slug`) to
 * the canonical office-scoped ones (`/team/offices/<slug>/google/reviews`).
 *
 * Old notification links and bookmarks keep working: the office slug that was a
 * query param becomes a route param and any extra params (e.g. `review=123`)
 * are preserved. With no office in the URL the legacy page still renders, so a
 * user landing on `/team/google` can still pick an office.
 */
export default function LegacyGoogleRedirect({
  tab = "",
  children,
}: {
  tab?: GoogleTab;
  children?: ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = officeSlugFromParams(searchParams);

  useEffect(() => {
    if (!slug) return;
    const target = officeGooglePath("team", slug, tab);
    const rest = new URLSearchParams(searchParams);
    rest.delete("office");
    rest.delete("slug");
    const qs = rest.toString();
    navigate(`${target}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [navigate, searchParams, slug, tab]);

  if (slug) return null;
  return <>{children}</>;
}
