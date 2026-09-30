import { Link } from "@tanstack/react-router";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import ReferralLinkCard from "@/components/dashboard/ReferralLinkCard";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import ReferralRegistrationFlow from "@/components/student/ReferralRegistrationFlow";

export default function StudentReferPage() {
  const userId = useAuthedUserId();
  const { t } = useTranslation("dashboard");

  if (!userId) return <DashboardLoading />;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("referralRegistration.eyebrow", "DARB")}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("referralRegistration.title", "Refer & Register")}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("referralRegistration.pageIntro", "Register a friend or family member directly through DARB. No office appointment is required.")}
          </p>
        </div>
        <Link
          to="/student"
          className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
        >
          {t("referralRegistration.backToDashboard", "Back to dashboard")}
        </Link>
      </div>

      <ReferralLinkCard userId={userId} />
      <ReferralRegistrationFlow userId={userId} />
    </div>
  );
}
