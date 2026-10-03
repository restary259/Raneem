import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  officeGooglePath,
  type GoogleTab,
  type OfficeSurface,
} from "@/lib/officeWorkspace";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

const TABS: GoogleTab[] = [
  "",
  "reviews",
  "profile",
  "photos",
  "posts",
  "insights",
];

const LABEL_KEY: Record<GoogleTab, string> = {
  "": "team.googleBusiness.tabOverview",
  reviews: "team.googleBusiness.tabReviews",
  profile: "team.googleBusiness.tabProfile",
  photos: "team.googleBusiness.tabPhotos",
  posts: "team.googleBusiness.tabPosts",
  insights: "team.googleBusiness.tabInsights",
};

type Props = {
  surface: OfficeSurface;
  slug: string | null;
  officeName?: string | null;
  active: GoogleTab;
};

/**
 * Google Business is a module *inside* an office, not a second system. This
 * sub-navigation keeps every Google page anchored to the office workspace route
 * (`/team/offices/<slug>/google/...`) so the office stays the navigation
 * context.
 */
export function GoogleOfficeSubnav({
  surface,
  slug,
  officeName,
  active,
}: Props) {
  const { t } = useTranslation("dashboard");
  if (!slug) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      {officeName ? (
        <span className="mr-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4" />
          {officeName}
        </span>
      ) : null}
      {TABS.map((tab) => {
        const isActive = active === tab;
        return (
          <Link
            key={tab || "overview"}
            to={officeGooglePath(surface, slug, tab)}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(LABEL_KEY[tab])}
          </Link>
        );
      })}
    </nav>
  );
}
