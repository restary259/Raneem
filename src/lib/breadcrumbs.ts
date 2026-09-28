const SITE = "https://darb.agency";

export type Crumb = { name: string; path: string };

/**
 * Build a Schema.org BreadcrumbList for a public page. `path` is a root-relative
 * URL; the home crumb is always the canonical origin. Mirrors the blog's inline
 * breadcrumb so every public page emits the same shape.
 */
export function buildBreadcrumbList(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.path ? `${SITE}${crumb.path}` : `${SITE}/`,
    })),
  };
}
