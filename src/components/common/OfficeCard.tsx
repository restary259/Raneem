import { useTranslation } from "react-i18next";
import { MapPin, Navigation, Phone } from "lucide-react";

export type OfficeCardData = {
  name_ar: string;
  name_en: string;
  name_he?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  phone?: string | null;
  map_url?: string | null;
};

export function formatIsraeliPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  return phone;
}

export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return "tel:" + (digits.startsWith("0") ? "+972" + digits.slice(1) : "+" + digits);
}

/** Shared office card: name, address, call + Google Maps actions. */
export default function OfficeCard({ office, compact = false }: { office: OfficeCardData; compact?: boolean }) {
  const { t, i18n } = useTranslation("landing");
  const lang = i18n.language || "ar";
  const name = lang.startsWith("ar") ? office.name_ar : lang.startsWith("he") ? office.name_he || office.name_en : office.name_en;
  const address = [office.address_line_1, office.city].filter(Boolean).join("، ");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <MapPin className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("office.label", "مكتب درب")}</p>
          <p className="text-base font-bold text-foreground">{name}</p>
          {address && !compact && <p className="mt-0.5 text-xs text-muted-foreground">{address}</p>}
        </div>
      </div>
      {(office.phone || office.map_url) && (
        <div className="grid grid-cols-2 gap-2 p-3">
          {office.phone && (
            <a href={telHref(office.phone)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5">
              <Phone className="size-4 text-primary" aria-hidden="true" />
              <span dir="ltr" className="tabular-nums">{formatIsraeliPhone(office.phone)}</span>
            </a>
          )}
          {office.map_url && (
            <a href={office.map_url} target="_blank" rel="noopener noreferrer" className={"inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 " + (office.phone ? "" : "col-span-2")}>
              <Navigation className="size-4" aria-hidden="true" />
              {t("office.openMap", "افتح بالخريطة")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
