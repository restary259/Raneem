import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CEFR_ORDER,
  formatBandLabel,
  formatEur,
  levelPlan,
  quoteAccommodation,
  quoteCourse,
  quoteStay,
  summerWeeks,
  totalWeeks,
  totalWeeksMax,
  type AccommodationPriceTier,
  type CoursePriceTier,
  type LevelDuration,
} from "@/lib/partnerSchools";

interface Props {
  courses: any[];
  courseTiers: any[];
  levels: LevelDuration[];
  accommodations: any[];
  accommodationTiers: any[];
  version: any | null;
  lang: string;
}

export default function SchoolCalculator({
  courses,
  courseTiers,
  levels,
  accommodations,
  accommodationTiers,
  version,
  lang,
}: Props) {
  const { t } = useTranslation("dashboard");
  const defaultCourse = courses.find((c) => c.is_darb_standard) ?? courses[0];
  const [courseId, setCourseId] = useState<string>(defaultCourse?.id ?? "");
  const [from, setFrom] = useState("A1");
  const [to, setTo] = useState("B2");
  const [withAcc, setWithAcc] = useState(false);
  const [accId, setAccId] = useState<string>(accommodations[0]?.id ?? "");
  const [accWeeks, setAccWeeks] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const course = courses.find((c) => c.id === courseId) ?? defaultCourse;
  const acc = accommodations.find((a) => a.id === accId) ?? accommodations[0];

  const plan = useMemo(() => levelPlan(from, to, levels), [from, to, levels]);
  const weeks = totalWeeks(plan);
  const weeksMax = totalWeeksMax(plan);
  const isRange = weeksMax > weeks;
  const missingLevels = plan.filter((p) => p.missing).map((p) => p.level);

  const tiers: CoursePriceTier[] = useMemo(
    () => courseTiers.filter((tier) => tier.course_id === course?.id),
    [courseTiers, course],
  );
  // Schools that charge a higher rate for the opening weeks publish the rule on the row.
  const courseRule = useMemo(
    () => ({
      surchargeWeeks: course?.surcharge_weeks ?? null,
      surchargeWaivedFromWeeks: course?.surcharge_waived_from_weeks ?? null,
    }),
    [course],
  );
  const pricedCourseIds = useMemo(
    () => new Set(courseTiers.map((tier) => tier.course_id)),
    [courseTiers],
  );
  const coursePriceMissing = course ? !pricedCourseIds.has(course.id) : true;
  const courseQuote = useMemo(() => quoteCourse(tiers, weeks, "booking", courseRule), [tiers, weeks, courseRule]);
  const courseQuoteMax = useMemo(
    () => (isRange ? quoteCourse(tiers, weeksMax, "booking", courseRule) : null),
    [tiers, weeksMax, isRange, courseRule],
  );
  const weeksLabel = isRange ? `${weeks}–${weeksMax}` : String(weeks);
  const courseTotalLabel = courseQuoteMax
    ? `${formatEur(courseQuote.total)} – ${formatEur(courseQuoteMax.total)}`
    : formatEur(courseQuote.total);

  const stayWeeks = accWeeks === "" ? weeks : Math.max(0, Number(accWeeks) || 0);
  const accTiers: AccommodationPriceTier[] = useMemo(
    () => accommodationTiers.filter((tier) => tier.accommodation_id === acc?.id),
    [accommodationTiers, acc],
  );
  // Schools that publish a nightly rate can quote a stay shorter than a week.
  const nightRate = useMemo(
    () => accTiers.find((tier) => tier.night_price != null)?.night_price ?? null,
    [accTiers],
  );
  const accRule = useMemo(
    () => ({
      surchargeWeeks: acc?.surcharge_weeks ?? null,
      surchargeWaivedFromWeeks: acc?.surcharge_waived_from_weeks ?? null,
    }),
    [acc],
  );
  const accQuote = useMemo(
    () => (withAcc ? quoteStay(accTiers, stayWeeks, accRule) : null),
    [withAcc, accTiers, stayWeeks, accRule],
  );
  const arrangementFee = withAcc ? Number(acc?.arrangement_fee ?? 0) : 0;
  const registrationFee = Number(course?.registration_fee ?? 0);

  const supplementWeeks = withAcc
    ? summerWeeks(startDate || null, stayWeeks, version?.summer_from ?? null, version?.summer_to ?? null)
    : 0;
  const supplement = supplementWeeks * Number(version?.summer_supplement_per_week ?? 0);

  const payable =
    (courseQuote.total ?? 0) + (accQuote?.total ?? 0) + arrangementFee + registrationFee + supplement;
  const incomplete = courseQuote.total == null || (withAcc && accQuote?.total == null) || missingLevels.length > 0;

  const answer = [
    `${from} → ${to}`,
    t("partnerSchools.copyWeeks", "{{weeks}} weeks", { weeks: weeksLabel }),
    lang === "ar" && course?.name_ar ? course.name_ar : course?.name_en ?? "",
    t("partnerSchools.copyCourse", "Course: {{total}} ({{weeks}} × {{rate}}/week)", {
      total: courseTotalLabel,
      weeks: weeksLabel,
      rate: formatEur(courseQuote.pricePerWeek),
    }),
    withAcc
      ? t("partnerSchools.copyAccommodation", "Accommodation ({{name}}, {{weeks}} weeks): {{total}}", {
          name: lang === "ar" && acc?.name_ar ? acc.name_ar : acc?.name_en,
          weeks: stayWeeks,
          total: formatEur(accQuote?.total ?? null),
        })
      : "",
    withAcc && arrangementFee
      ? t("partnerSchools.copyArrangement", "Accommodation arrangement: {{total}}", { total: formatEur(arrangementFee) })
      : "",
    registrationFee
      ? t("partnerSchools.copyRegistration", "Registration fee: {{total}}", { total: formatEur(registrationFee) })
      : "",
    supplement
      ? t("partnerSchools.copySummer", "Summer supplement: {{total}}", { total: formatEur(supplement) })
      : "",
    t("partnerSchools.copyPayable", "Estimated payable: {{total}}", { total: formatEur(payable) }),
    isRange
      ? t(
          "partnerSchools.rangeNote",
          "This school publishes a range of teaching hours per level, so the duration and price are a range.",
        )
      : "",
    withAcc ? t("partnerSchools.depositSeparate", "Security deposit is separate — amount to confirm with the school.") : "",
  ]
    .filter(Boolean)
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Inputs */}
      <Card className="space-y-4 p-4 shadow-none">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t("partnerSchools.startingLevel", "Starting level")}</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CEFR_ORDER.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("partnerSchools.targetLevel", "Target level")}</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CEFR_ORDER.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("partnerSchools.course", "Course")}</Label>
            <Select value={course?.id ?? ""} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {lang === "ar" && c.name_ar ? c.name_ar : c.name_en}
                    {pricedCourseIds.has(c.id)
                      ? ""
                      : ` — ${t("partnerSchools.noPublishedPrice", "no published weekly price")}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="addacc" className="cursor-pointer">
            {t("partnerSchools.addAccommodation", "Add accommodation")}
          </Label>
          <Switch id="addacc" checked={withAcc} onCheckedChange={setWithAcc} />
        </div>

        {withAcc && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label>{t("partnerSchools.accommodationType", "Accommodation")}</Label>
              <Select value={acc?.id ?? ""} onValueChange={setAccId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accommodations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {lang === "ar" && a.name_ar ? a.name_ar : a.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("partnerSchools.accWeeks", "Accommodation weeks")}</Label>
              <Input
                type="number"
                min={0}
                value={accWeeks}
                placeholder={nightRate != null ? "0" : String(weeks)}
                onChange={(e) => setAccWeeks(e.target.value)}
              />
              {nightRate != null && (
                <p className="text-xs text-muted-foreground">
                  {t("partnerSchools.accNightHint", "Enter 0 for a single night at {{rate}}.", { rate: formatEur(nightRate) })}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("partnerSchools.startDate", "Start date")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
        )}

        {/* Breakdown */}
        <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          <div className="font-medium text-foreground">{t("partnerSchools.breakdown", "Calculation")}</div>
          <ul className="space-y-1 text-muted-foreground">
            {plan.map((p) => (
              <li key={p.level} className="flex justify-between">
                <span>{p.level}</span>
                <span>
                  {p.missing
                    ? t("partnerSchools.notRecorded", "Not recorded — verify with the school")
                    : `${p.weeksMax > p.weeks ? `${p.weeks}–${p.weeksMax}` : p.weeks} ${t("partnerSchools.weeks", "weeks")}`}
                </span>
              </li>
            ))}
            {courseQuote.band && (
              <li className="flex justify-between border-t border-border pt-1">
                <span>
                  {weeksLabel} × {formatEur(courseQuote.pricePerWeek)} ({formatBandLabel(courseQuote.band, lang === "ar" ? "ar" : "en")})
                </span>
                <span>{courseTotalLabel}</span>
              </li>
            )}
            {withAcc && accQuote?.tier && (
              <li className="flex justify-between">
                <span>
                  {lang === "ar" && acc?.name_ar ? acc.name_ar : acc?.name_en} · {stayWeeks} {t("partnerSchools.weeks", "weeks")}
                  {accQuote.perWeek ? ` × ${formatEur(accQuote.perWeek)}` : ""}
                </span>
                <span>{formatEur(accQuote.total)}</span>
              </li>
            )}
            {withAcc && !accQuote?.tier && accQuote?.total != null && (
              <li className="flex justify-between">
                <span>
                  {lang === "ar" && acc?.name_ar ? acc.name_ar : acc?.name_en} · {t("partnerSchools.night", "1 night")}
                </span>
                <span>{formatEur(accQuote.total)}</span>
              </li>
            )}
            {registrationFee > 0 && (
              <li className="flex justify-between">
                <span>{t("partnerSchools.registrationFee", "Registration fee")}</span>
                <span>{formatEur(registrationFee)}</span>
              </li>
            )}
          </ul>
        </div>
      </Card>

      {/* Result */}
      <Card className="h-fit space-y-3 border-brand/40 p-4 shadow-none">
        <div className="text-sm text-muted-foreground">{from} → {to}</div>
        <div className="text-3xl font-semibold text-foreground">
          {weeksLabel} {t("partnerSchools.weeks", "weeks")}
        </div>
        <div className="text-2xl font-semibold text-brand">{courseTotalLabel}</div>
        <div className="text-xs text-muted-foreground">
          {t("partnerSchools.courseTuition", "Course tuition (school price)")}
        </div>
        {isRange && (
          <p className="rounded-md bg-muted/50 p-2 text-xs leading-5 text-muted-foreground">
            {t(
              "partnerSchools.rangeNote",
              "This school publishes a range of teaching hours per level, so the duration and price are a range.",
            )}
          </p>
        )}

        <div className="space-y-1.5 border-t border-border pt-3 text-sm">
          <Row label={t("partnerSchools.course", "Course")} value={courseTotalLabel} />
          {registrationFee > 0 && (
            <Row label={t("partnerSchools.registrationFee", "Registration fee")} value={formatEur(registrationFee)} />
          )}
          {withAcc && (
            <>
              <Row label={t("partnerSchools.accommodation", "Accommodation")} value={formatEur(accQuote?.total ?? null)} />
              {arrangementFee > 0 && (
                <Row label={t("partnerSchools.arrangementFee", "Accommodation arrangement")} value={formatEur(arrangementFee)} />
              )}
            </>
          )}
          {supplement > 0 && (
            <Row label={t("partnerSchools.summerSupplement", "Summer supplement")} value={formatEur(supplement)} />
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
            <span>{t("partnerSchools.estimatedPayable", "Estimated payable cost")}</span>
            <span>{formatEur(payable)}</span>
          </div>
        </div>

        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          {t(
            "partnerSchools.depositSeparate",
            "Security deposit is separate and not included above — amount to confirm with the school.",
          )}
        </p>
        {incomplete && (
          <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            {t("partnerSchools.incomplete", "Some values are not recorded — verify with the school before quoting.")}
          </p>
        )}

        <Button className="w-full" variant="outline" onClick={copy}>
          {copied ? <Check className="me-2 h-4 w-4" /> : <Copy className="me-2 h-4 w-4" />}
          {t("partnerSchools.copyAnswer", "Copy answer")}
        </Button>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
