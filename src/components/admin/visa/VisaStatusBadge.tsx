import { Badge } from "@/components/ui/badge";
import { normalizeVisaStatus, visaStatusClasses } from "@/lib/visaStatus";
import { useTranslation } from "react-i18next";

/**
 * Shared Visa-status pill. Uses the ONE canonical status vocabulary
 * (`visaStatus.ts`) mapped onto the semantic status tokens — the same tones the
 * student Visa page uses, so admin and student never disagree on wording or
 * colour.
 */
export default function VisaStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");
  const key = normalizeVisaStatus(status);
  return (
    <Badge
      variant="outline"
      className={`${visaStatusClasses(key)} border-0 ${className ?? ""}`}
    >
      {t(`admin.visa.status.${key}`, key.replace(/_/g, " "))}
    </Badge>
  );
}
