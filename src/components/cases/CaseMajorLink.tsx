import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@/lib/router-compat";
import { Check, ExternalLink, GraduationCap, Search, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getMajorIntel, searchMajors } from "@/data/intel/majorIntel";
import type { MajorIntel } from "@/data/intel/types";

interface Props {
  caseId: string;
  /** Raw text the student typed on the apply form. Never overwritten. */
  degreeInterest: string | null;
  /** Currently confirmed major id, if any. */
  majorId: string | null;
}

/**
 * Links a case to a DARB Major Intelligence major.
 *
 * The apply form stores free text, so the match is only ever a SUGGESTION:
 * a team member confirms it before anything is stored. `degree_interest`
 * stays the raw record of what the student wrote.
 */
export default function CaseMajorLink({ caseId, degreeInterest, majorId }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n?.language === "ar";
  const { toast } = useToast();

  const [linkedId, setLinkedId] = useState<string | null>(majorId);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setLinkedId(majorId), [majorId]);

  const linked = linkedId ? getMajorIntel(linkedId) : undefined;
  const suggestions = useMemo(
    () => (degreeInterest ? searchMajors(degreeInterest, 4) : []),
    [degreeInterest],
  );
  const searchResults = useMemo(() => (query.trim() ? searchMajors(query, 8) : []), [query]);

  const name = (m: MajorIntel) => (isAr ? m.canonicalAR : m.canonicalEN);

  async function save(next: string | null) {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("cases")
      .update({
        intel_major_id: next,
        intel_major_confirmed_by: next ? auth.user?.id ?? null : null,
        intel_major_confirmed_at: next ? new Date().toISOString() : null,
      } as never)
      .eq("id", caseId);
    setSaving(false);
    if (error) {
      toast({
        variant: "destructive",
        title: t("case.majorLink.saveFailed", "Could not save the field of study"),
        description: error.message,
      });
      return;
    }
    setLinkedId(next);
    setPicking(false);
    setQuery("");
  }

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">{t("case.majorLink.title", "Field of study")}</span>
      </div>

      {degreeInterest && (
        <p className="text-xs text-muted-foreground">
          {t("case.majorLink.studentWrote", "The student wrote")}:{" "}
          <span className="text-foreground">{degreeInterest}</span>
        </p>
      )}

      {linked && !picking ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            {linked.status === "verified" && (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            )}
            {name(linked)}
          </Badge>
          {linked.status !== "verified" && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t("case.majorLink.notVerified", "Not verified yet")}
            </span>
          )}
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to={`/team/majors?major=${linked.id}&case=${caseId}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {t("case.majorLink.open", "Open in Major Intelligence")}
            </Link>
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setPicking(true)}>
            {t("case.majorLink.change", "Change")}
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => save(null)}>
            <X className="h-3.5 w-3.5" aria-hidden />
            {t("case.majorLink.clear", "Clear")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!picking && suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("case.majorLink.suggested", "Suggested")}:
              </span>
              {suggestions.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={saving}
                  onClick={() => save(m.id)}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {name(m)}
                </Button>
              ))}
            </div>
          )}

          {!picking && suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("case.majorLink.noMatch", "No matching major — pick one below.")}
            </p>
          )}

          {!picking ? (
            <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
              {t("case.majorLink.pick", "Choose another major")}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute inset-y-0 start-2 my-auto h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(
                    "case.majorLink.searchPlaceholder",
                    "علوم الحاسوب · Computer Science · Informatik",
                  )}
                  className="ps-8"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {searchResults.map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => save(m.id)}
                  >
                    {name(m)}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setPicking(false); setQuery(""); }}>
                {t("case.majorLink.cancel", "Cancel")}
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {t(
          "case.majorLink.note",
          "This only records which field of study the case is about. It decides nothing about eligibility.",
        )}
      </p>
    </section>
  );
}
