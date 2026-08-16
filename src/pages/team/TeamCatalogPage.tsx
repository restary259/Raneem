import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import { parseTiers } from "@/components/admin/PriceTiersEditor";

const db: any = supabase as unknown as any;

interface School {
  id: string;
  name_ar: string;
  name_en: string;
  city: string | null;
  country: string | null;
  is_active: boolean;
}

interface Program {
  id: string;
  name_ar: string;
  name_en: string;
  type: string | null;
  duration: string | null;
  price: number | null;
  currency: string;
  school_id: string | null;
  is_active: boolean;
}

interface Accommodation {
  id: string;
  name_ar: string;
  name_en: string;
  price: number | null;
  currency: string;
  description: string | null;
  is_active: boolean;
  school_id: string | null;
  deposit: number | null;
  placement_fee: number | null;
  meals: string | null;
  room_type: string | null;
  distance_note: string | null;
  price_tiers: unknown;
}

interface Photo {
  id: string;
  storage_path: string;
  display_order: number;
  url?: string;
}

export function groupBySchoolId<T extends { school_id: string | null }>(
  items: T[],
): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    if (!item.school_id) continue;
    (map[item.school_id] ??= []).push(item);
  }
  return map;
}

/** Price-tier chips + displayed price for an accommodation (read-only). */
const PriceTierBlock: React.FC<{ accom: Accommodation }> = ({ accom }) => {
  const { t } = useTranslation("dashboard");
  const tiers = useMemo(() => parseTiers(accom.price_tiers), [accom.price_tiers]);
  const [selected, setSelected] = useState(0);
  const activeTier = tiers[selected];
  const displayPrice = activeTier?.price ?? accom.price;

  if (tiers.length === 0) {
    return (
      <div className="space-y-1">
        <div className="rounded-md bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {t("team.catalog.flatPrice")}
        </div>
        <p className="text-sm font-semibold">
          {accom.price != null
            ? `${Number(accom.price).toLocaleString("en-US")} ${accom.currency}`
            : "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-md bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        {t("team.catalog.perWeek")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tiers.map((tier, idx) => {
          const from = tier.from_weeks ?? 1;
          const label =
            tier.to_weeks == null
              ? t("team.catalog.openEnded", { from })
              : t("team.catalog.weekRange", { from, to: tier.to_weeks });
          return (
            <Badge
              key={idx}
              variant={idx === selected ? "default" : "secondary"}
              className="cursor-pointer select-none"
              onClick={() => setSelected(idx)}
            >
              {label}
            </Badge>
          );
        })}
      </div>
      <p className="text-sm font-semibold">
        {displayPrice != null
          ? `${Number(displayPrice).toLocaleString("en-US")} ${accom.currency}`
          : "—"}
      </p>
    </div>
  );
};

/** Accommodation card (read-only). Clicking opens the photo slideshow. */
const AccommodationCard: React.FC<{
  accom: Accommodation;
  onOpen: (a: Accommodation) => void;
}> = ({ accom, onOpen }) => {
  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-all cursor-pointer"
      onClick={() => onOpen(accom)}
    >
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-semibold">{accom.name_en}</p>
        {accom.room_type || accom.meals ? (
          <p className="text-xs text-muted-foreground">
            {[accom.room_type, accom.meals].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <PriceTierBlock accom={accom} />
        {accom.distance_note ? (
          <p className="text-xs text-muted-foreground">{accom.distance_note}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

/** Photo slideshow dialog (lazy-loads signed URLs on open). */
const PhotoSlideshow: React.FC<{
  accom: Accommodation | null;
  onOpenChange: (open: boolean) => void;
}> = ({ accom, onOpenChange }) => {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.dir() === "rtl";
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (!accom) {
      setPhotos([]);
      setCurrent(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPhotos([]);
    setCurrent(0);
    (async () => {
      try {
        const { data, error } = await db
          .from("accommodation_photos")
          .select("id, storage_path, display_order")
          .eq("accommodation_id", accom.id)
          .order("display_order");
        if (error || cancelled) return;
        const rows: Photo[] = data ?? [];
        const withUrls = await Promise.all(
          rows.map(async (p) => {
            const { data: signed, error: urlErr } = await supabase.storage
              .from("accommodation-photos")
              .createSignedUrl(p.storage_path, 3600);
            return { ...p, url: urlErr ? undefined : signed?.signedUrl };
          }),
        );
        if (!cancelled) {
          setPhotos(withUrls);
          setCurrent(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accom]);

  const count = photos.length;
  const go = (dir: 1 | -1) =>
    setCurrent((c) => (count <= 1 ? c : (c + dir + count) % count));

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart == null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 50) go(isRtl ? (delta > 0 ? 1 : -1) : delta > 0 ? -1 : 1);
    setTouchStart(null);
  };

  return (
    <Dialog open={!!accom} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-full"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(isRtl ? 1 : -1);
          else if (e.key === "ArrowRight") go(isRtl ? -1 : 1);
        }}
      >
        <DialogHeader>
          <DialogTitle>{accom?.name_en ?? ""}</DialogTitle>
        </DialogHeader>
        <div
          className="relative flex items-center justify-center bg-muted/30 rounded-md overflow-hidden"
          style={{ minHeight: 360 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <ImageOff className="h-10 w-10" />
              <p className="text-sm">{t("team.catalog.noPhotos")}</p>
            </div>
          ) : (
            <>
              {photos[current]?.url ? (
                <img
                  src={photos[current]?.url}
                  alt={accom?.name_en ?? ""}
                  className="max-h-[60vh] w-auto object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <ImageOff className="h-10 w-10" />
                  <p className="text-sm">{t("team.catalog.noPhotos")}</p>
                </div>
              )}
              {count > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute start-2 rounded-full"
                    onClick={() => go(isRtl ? 1 : -1)}
                  >
                    <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute end-2 rounded-full"
                    onClick={() => go(isRtl ? -1 : 1)}
                  >
                    <ChevronRight className="h-6 w-6 rtl:rotate-180" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        {count > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setCurrent(idx)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  idx === current ? "bg-foreground" : "bg-muted-foreground/40"
                }`}
                aria-label={`photo ${idx + 1}`}
              />
            ))}
          </div>
        )}
        {accom && (
          <div className="border-t pt-3">
            <PriceTierBlock accom={accom} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const TeamCatalogPage: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [slideAccom, setSlideAccom] = useState<Accommodation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [schoolsRes, programsRes, accomRes] = await Promise.all([
          db.from("schools").select("*").eq("is_active", true).order("name_en"),
          db.from("programs").select("*").eq("is_active", true),
          db.from("accommodations").select("*").eq("is_active", true),
        ]);
        if (cancelled) return;
        setSchools((schoolsRes.data ?? []) as School[]);
        setPrograms((programsRes.data ?? []) as Program[]);
        setAccommodations((accomRes.data ?? []) as Accommodation[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const programsBySchool = useMemo(() => groupBySchoolId(programs), [programs]);
  const accomBySchool = useMemo(() => groupBySchoolId(accommodations), [accommodations]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{t("team.catalog.title")}</h1>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : schools.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          {t("team.catalog.noSchools")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((s) => {
            const programCount = (programsBySchool[s.id] ?? []).length;
            return (
              <Card
                key={s.id}
                className="overflow-hidden hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedSchool(s)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--status-submitted)/0.12)]">
                      <Building2 className="h-4 w-4 text-[hsl(var(--status-submitted))]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name_en}</p>
                      <p className="text-xs text-muted-foreground">
                        {[s.city, s.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {t("team.catalog.programsTab")} · {programCount}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!selectedSchool}
        onOpenChange={(v) => !v && setSelectedSchool(null)}
      >
        <SheetContent
          side="right"
          className="sm:max-w-xl w-full sm:w-[36rem] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{selectedSchool?.name_en ?? ""}</SheetTitle>
          </SheetHeader>
          {selectedSchool && (
            <Tabs defaultValue="programs" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="programs" className="flex-1">
                  {t("team.catalog.programsTab")}
                </TabsTrigger>
                <TabsTrigger value="accommodations" className="flex-1">
                  {t("team.catalog.accommodationsTab")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="programs" className="mt-4 space-y-2">
                {(programsBySchool[selectedSchool.id] ?? []).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {t("team.catalog.noPrograms")}
                  </p>
                ) : (
                  (programsBySchool[selectedSchool.id] ?? []).map((p) => (
                    <div key={p.id} className="rounded-md border p-3 space-y-0.5">
                      <p className="text-sm font-semibold">{p.name_en}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.type, p.duration]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {p.price != null && (
                        <p className="text-xs text-muted-foreground">
                          {Number(p.price).toLocaleString("en-US")} {p.currency}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="accommodations" className="mt-4">
                {(accomBySchool[selectedSchool.id] ?? []).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {t("team.catalog.noAccommodations")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {(accomBySchool[selectedSchool.id] ?? []).map((a) => (
                      <AccommodationCard
                        key={a.id}
                        accom={a}
                        onOpen={setSlideAccom}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <PhotoSlideshow accom={slideAccom} onOpenChange={(v) => !v && setSlideAccom(null)} />
    </div>
  );
};

export default TeamCatalogPage;
