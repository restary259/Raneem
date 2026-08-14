import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, GraduationCap } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const TeamCasesPage = lazy(() => import("./TeamCasesPage"));
const TeamStudentsPage = lazy(() => import("./TeamStudentsPage"));

/**
 * People hub for the team — active cases and enrolled student accounts are the
 * same population at two lifecycle points, so they share one destination.
 * `/team/students` redirects here with `?tab=students`; `/team/students/:id`
 * still resolves to the student profile page.
 */
export default function TeamCasesHubPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "cases",
      label: t("nav.cases", "Cases"),
      icon: ClipboardList,
      render: () => <TeamCasesPage />,
    },
    {
      value: "students",
      label: t("nav.students", "Students"),
      icon: GraduationCap,
      render: () => <TeamStudentsPage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
