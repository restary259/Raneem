import { createFileRoute } from "@tanstack/react-router";
import WhoWeArePage from "@/pages/WhoWeArePage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "عن درب | About DARB" },
      { name: "description", content: "تعرّف على قصة درب ورسالتها وطريقة عمل فريقها في تنظيم طريق الدراسة في ألمانيا بوضوح ومسؤولية." },
      { property: "og:title", content: "عن درب | About DARB" },
      { property: "og:description", content: "قصة درب ورسالتها وطريقة عملها مع الطلاب خطوة بخطوة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhoWeArePage,
});
