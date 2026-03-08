import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, RotateCcw, Info, AlertTriangle, TrendingUp } from "lucide-react";

/* ─── Types & constants ──────────────────────────────────────────────────── */
type Subject = { id: string; units: string; grade: string };

const NMAX = 100;
const NMIN = 56;

const SUBJECT_GROUPS = [
  {
    label: "المواد الإلزامية",
    labelEn: "Compulsory",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    subjects: ["arabic", "hebrew", "english", "math"],
  },
  {
    label: "التربية",
    labelEn: "Civic & Religion",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    subjects: ["history", "deen", "mdniat"],
  },
  {
    label: "التخصصات",
    labelEn: "Specializations",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    subjects: ["t5sos1", "t5sos2", "t5sos3"],
  },
];

const ALL_SUBJECT_IDS = SUBJECT_GROUPS.flatMap((g) => g.subjects);
const initialSubjects: Subject[] = ALL_SUBJECT_IDS.map((id) => ({ id, units: "", grade: "" }));

/* ─── Helper ─────────────────────────────────────────────────────────────── */
function getGermanLabel(grade: number): { label: string; arabic: string; color: string } {
  if (grade <= 1.5) return { label: "Sehr Gut",     arabic: "ممتاز",    color: "bg-emerald-50 text-emerald-700 border-emerald-300" };
  if (grade <= 2.5) return { label: "Gut",           arabic: "جيد جداً", color: "bg-blue-50 text-blue-700 border-blue-300" };
  if (grade <= 3.5) return { label: "Befriedigend",  arabic: "جيد",      color: "bg-amber-50 text-amber-700 border-amber-300" };
  return               { label: "Ausreichend",    arabic: "مقبول",    color: "bg-orange-50 text-orange-700 border-orange-300" };
}

function getAverageColor(avg: number): string {
  if (avg >= 80) return "text-emerald-600";
  if (avg >= 65) return "text-blue-600";
  if (avg >= 56) return "text-amber-600";
  return "text-destructive";
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function BagrutConverter() {
  const { t, i18n } = useTranslation("dashboard");
  const { t: tr } = useTranslation("resources");
  const isAr = i18n.language === "ar";

  const [subjects, setSubjects] = useState<Subject[]>(() => JSON.parse(JSON.stringify(initialSubjects)));
  const [results, setResults] = useState<{ average: number; germanGrade: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleChange = (index: number, field: "units" | "grade", value: string) => {
    const updated = [...subjects];
    if (field === "grade" && value) {
      const n = parseInt(value, 10);
      if (n < 0) value = "0";
      if (n > 100) value = "100";
    }
    updated[index][field] = value;
    setSubjects(updated);
  };

  const handleCalculate = () => {
    setError(null);
    setWarnings([]);
    const valid = subjects.filter((s) => s.units && s.grade);
    if (valid.length === 0) {
      setError(tr("gpaCalculator.errorMinSubjects"));
      setResults(null);
      return;
    }
    for (const s of valid) {
      const u = parseInt(s.units, 10);
      const g = parseInt(s.grade, 10);
      if (u < 1 || u > 5) {
        setError(tr("gpaCalculator.errorUnitsRange"));
        setResults(null);
        return;
      }
      if (g < 0 || g > 100) {
        setError(tr("gpaCalculator.errorGradeRange"));
        setResults(null);
        return;
      }
    }
    const totalWeighted = valid.reduce((acc, s) => acc + parseInt(s.units) * parseInt(s.grade), 0);
    const totalUnits = valid.reduce((acc, s) => acc + parseInt(s.units), 0);
    if (totalUnits === 0) {
      setError(tr("gpaCalculator.errorZeroUnits"));
      setResults(null);
      return;
    }

    const average = totalWeighted / totalUnits;
    const newWarnings: string[] = [];
    if (average < NMIN) newWarnings.push(tr("gpaCalculator.warningBelowPass", { avg: average.toFixed(1), min: NMIN }));

    const raw = 1 + 3 * ((NMAX - average) / (NMAX - NMIN));
    const germanGrade = parseFloat(Math.max(1.0, Math.min(4.0, raw)).toFixed(2));
    setWarnings(newWarnings);
    setResults({ average: parseFloat(average.toFixed(2)), germanGrade });
  };

  const handleReset = () => {
    setSubjects(JSON.parse(JSON.stringify(initialSubjects)));
    setResults(null);
    setError(null);
    setWarnings([]);
  };

  const filledCount = subjects.filter((s) => s.units && s.grade).length;
  const germanLabel = results ? getGermanLabel(results.germanGrade) : null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("nav.bagrut", "أداة البجروت")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("team.bagrut.subtitle", "تحويل درجات البجروت إلى درجات الجامعات الألمانية")}
        </p>
      </div>

      {/* ── Progress pill ── (always visible) */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(filledCount / ALL_SUBJECT_IDS.length) * 100}%` }}
          />
        </div>
        <span className="tabular-nums shrink-0">
          {filledCount}/{ALL_SUBJECT_IDS.length} {isAr ? "مادة" : "subjects"}
        </span>
      </div>

      {/* ── Subject groups ── */}
      <div className="space-y-4">
        {SUBJECT_GROUPS.map((group) => (
          <Card key={group.label} className="overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
              <span className={`w-2 h-2 rounded-full ${group.dot} shrink-0`} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isAr ? group.label : group.labelEn}
              </span>
            </div>

            <CardContent className="p-0">
              {group.subjects.map((subjectId, idx) => {
                const globalIdx = ALL_SUBJECT_IDS.indexOf(subjectId);
                const subject = subjects[globalIdx];
                const isLast = idx === group.subjects.length - 1;
                return (
                  <div key={subjectId}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Label — no truncation, allow wrapping */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground leading-tight">
                          {tr(`gpaCalculator.subjects.${subjectId}`)}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <p className="text-xs">{tr("gpaCalculator.tooltipText")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Inputs */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Select value={subject.units} onValueChange={(v) => handleChange(globalIdx, "units", v)}>
                          <SelectTrigger className="w-24 h-8 text-sm">
                            <SelectValue placeholder={isAr ? "الوحدات" : "Units"} />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <SelectItem key={i} value={String(i)}>
                                {i} {isAr ? "وح" : "u"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          placeholder="0–100"
                          min="0"
                          max="100"
                          value={subject.grade}
                          onChange={(e) => handleChange(globalIdx, "grade", e.target.value)}
                          className="w-20 h-8 text-sm text-center tabular-nums"
                        />

                        {/* Filled indicator */}
                        <div
                          className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                            subject.units && subject.grade ? group.dot : "bg-muted"
                          }`}
                        />
                      </div>
                    </div>
                    {!isLast && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Error / Warnings ── */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {warnings.map((w, i) => (
        <Alert key={i} className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">{w}</AlertDescription>
        </Alert>
      ))}

      {/* ── Results card ── */}
      {results && germanLabel && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-primary">{isAr ? "النتيجة" : "Results"}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Bagrut average */}
              <div className="bg-background rounded-lg border p-4 text-center">
                <div className={`text-3xl font-bold tabular-nums ${getAverageColor(results.average)}`}>
                  {results.average}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{isAr ? "معدل البجروت" : "Bagrut Average"}</div>
                <div className="mt-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${results.average}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 tabular-nums">{results.average} / 100</div>
                </div>
              </div>

              {/* German grade */}
              <div className="bg-background rounded-lg border p-4 text-center">
                <div className="text-3xl font-bold tabular-nums text-foreground">{results.germanGrade}</div>
                <div className="text-xs text-muted-foreground mt-1">{isAr ? "النظام الألماني" : "German Grade"}</div>
                <div className="mt-2 flex flex-col items-center gap-1">
                  <Badge variant="outline" className={`text-xs ${germanLabel.color}`}>
                    {germanLabel.label}
                  </Badge>
                  {isAr && (
                    <span className="text-xs text-muted-foreground">{germanLabel.arabic}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Formula note */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p dir="ltr" className="text-xs font-mono text-center text-muted-foreground">
                German Grade = 1 + 3 × ((100 − Average) / (100 − 56))
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={handleCalculate}
          className="flex-1 sm:flex-none gap-2"
          disabled={filledCount === 0}
        >
          <Calculator className="h-4 w-4" />
          {isAr ? "احسب المعدل" : "Calculate"}
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleReset}
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={isAr ? "إعادة تعيين" : "Reset"}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{isAr ? "إعادة تعيين" : "Reset"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
