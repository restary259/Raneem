import { describe, it, expect } from "vitest";
import { buildBreadcrumbList } from "./breadcrumbs";

describe("buildBreadcrumbList", () => {
  it("emits a position-ordered BreadcrumbList on the canonical origin", () => {
    const list = buildBreadcrumbList([
      { name: "الرئيسية", path: "/" },
      { name: "خدماتنا", path: "/services" },
    ]);

    expect(list["@context"]).toBe("https://schema.org");
    expect(list["@type"]).toBe("BreadcrumbList");
    expect(list.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "الرئيسية",
        item: "https://darb.agency/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "خدماتنا",
        item: "https://darb.agency/services",
      },
    ]);
  });

  it("anchors the root crumb to the brand domain regardless of incoming path", () => {
    const list = buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
    ]);
    expect(list.itemListElement[0].item).toBe("https://darb.agency/");
    expect(list.itemListElement[1].item).toBe("https://darb.agency/blog");
  });
});
