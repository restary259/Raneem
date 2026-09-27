import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Loader2, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/hooks/useDirection";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import PublicOfficeBooking from "@/components/apply/PublicOfficeBooking";
import { startPublicBooking } from "@/lib/publicBooking.functions";

export const Route = createFileRoute("/book-appointment")({
  head: () => ({
    meta: [
      { title: "Book a DARB appointment | درب" },
      { name: "description", content: "Book an appointment at a DARB office." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Book a DARB appointment | درب" },
      { property: "og:description", content: "Choose a DARB office and book an available appointment." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: BookAppointmentPage,
});

function BookAppointmentPage() {
  const { dir } = useDirection();
  const { t, i18n } = useTranslation("landing");
  const isAr = i18n.language.startsWith("ar");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const ui = isAr
    ? {
        eyebrow: "مواعيد درب",
        title: "احجز موعدك",
        body: "اختار المكتب والوقت اللي بناسبك، وبنكمل معك من هناك.",
        name: "الاسم الكامل",
        namePlaceholder: "اكتب اسمك",
        phone: "رقم الهاتف / واتساب",
        phonePlaceholder: "052...",
        continue: "كمّل للحجز",
        privacy: "ما بنطلب تسجيل دخول. بياناتك تُستخدم فقط لفتح موعدك والتواصل معك.",
        error: "تأكد من الاسم ورقم الهاتف وحاول مرة ثانية.",
        back: "رجوع",
      }
    : i18n.language.startsWith("he")
      ? {
          eyebrow: "פגישות DARB",
          title: "קביעת פגישה",
          body: "בחרו משרד ושעה שמתאימים לכם ונמשיך משם.",
          name: "שם מלא",
          namePlaceholder: "הקלידו את השם שלכם",
          phone: "טלפון / WhatsApp",
          phonePlaceholder: "05...",
          continue: "המשך להזמנה",
          privacy: "אין צורך להתחבר. הפרטים משמשים לפתיחת ההזמנה וליצירת קשר איתכם.",
          error: "בדקו את השם ומספר הטלפון ונסו שוב.",
          back: "חזרה",
        }
      : {
          eyebrow: "DARB APPOINTMENTS",
          title: "Book your appointment",
          body: "Choose an office and a time that works for you, then we’ll take it from there.",
          name: "Full name",
          namePlaceholder: "Enter your name",
          phone: "Phone / WhatsApp",
          phonePlaceholder: "05...",
          continue: "Continue to booking",
          privacy: "No login required. Your details are used to open the booking and contact you about it.",
          error: "Check your name and phone number, then try again.",
          back: "Back",
        };

  async function start() {
    setError("");
    if (fullName.trim().length < 2 || phone.trim().length < 8) {
      setError(ui.error);
      return;
    }

    setWorking(true);
    try {
      const result = await startPublicBooking({ data: { fullName, phone } });
      if (!result.token || !/^[0-9a-f]{64}$/.test(result.token)) {
        throw new Error("Invalid booking session");
      }
      setToken(result.token);
    } catch (err) {
      setError(err instanceof Error && err.message === "Too many booking requests" ? "Too many attempts. Please try again later." : ui.error);
    } finally {
      setWorking(false);
    }
  }

  return (
    <main dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <a href="/" aria-label={t("loader.brand")} className="flex items-center">
            <img
              src={darbLogoAsset.url}
              alt={t("loader.brand")}
              className="h-9 w-auto object-contain"
              fetchPriority="high"
            />
          </a>
          <LanguageSwitcher className="[&>button]:min-h-11 [&>button]:text-xs [&>span]:text-xs" />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
        {!token ? (
          <div className="mx-auto max-w-xl">
            <div className="mb-8 space-y-3 text-center">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand-strong">{ui.eyebrow}</p>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{ui.title}</h1>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base">{ui.body}</p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-surface-lg">
              <div className="h-2 bg-gradient-to-r from-[hsl(var(--darb-blue))] via-[hsl(var(--darb-teal))] to-[hsl(var(--darb-yellow))]" />
              <div className="space-y-5 p-6 sm:p-8">
                <div className="space-y-2">
                  <label htmlFor="public-booking-name" className="text-sm font-semibold">{ui.name}</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="public-booking-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder={ui.namePlaceholder}
                      autoComplete="name"
                      className="h-12 rounded-2xl ps-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="public-booking-phone" className="text-sm font-semibold">{ui.phone}</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="public-booking-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder={ui.phonePlaceholder}
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      className="h-12 rounded-2xl ps-10"
                    />
                  </div>
                </div>

                {error && <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

                <Button onClick={start} disabled={working} className="h-12 w-full rounded-full text-sm font-bold">
                  {working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CalendarDays className="size-4" aria-hidden="true" />}
                  {ui.continue}
                </Button>

                <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{ui.privacy}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" aria-hidden="true" />
                {ui.back}
              </a>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand-strong">{ui.eyebrow}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{ui.title}</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{ui.body}</p>
            </div>
            <PublicOfficeBooking token={token} autoOpen />
          </div>
        )}
      </section>
    </main>
  );
}
