import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPinned, ChevronRight, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "@/lib/router-compat";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useDirection } from "@/hooks/useDirection";
import { getCityGuide } from "@/data/studentCityGuides";
import { resolveStudentGuideCity } from "@/lib/studentGuideCity";

/** Shows a link to the city guide of the student's school city, when one exists. */
export default function StudentCityGuideLinkCard() {
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const userId = useAuthedUserId();
  const { isRtl } = useDirection() as { isRtl?: boolean };
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    resolveStudentGuideCity(userId)
      .then((r) => active && setCity(r.city))
      .catch(() => active && setCity(null));
    return () => {
      active = false;
    };
  }, [userId]);

  const guide = getCityGuide(city);
  if (!guide) return null;
  const lang = i18n.language;
  const name = lang.startsWith("ar") ? guide.nameAr : lang.startsWith("he") ? guide.nameHe : guide.nameEn;
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => navigate("/student/city-guide")}
      onKeyDown={(e) => e.key === "Enter" && navigate("/student/city-guide")}
      className="cursor-pointer transition-colors hover:bg-muted/50"
    >
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPinned className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("student.cityGuide.yourCity")}</p>
          <p className="truncate font-semibold">{name}</p>
        </div>
        <span className="text-sm font-medium text-primary">{t("student.cityGuide.openGuide")}</span>
        <Chevron className="size-4 text-primary" />
      </CardContent>
    </Card>
  );
}
