import { Mail, MessageCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { DARB_CONTACT_ADVISOR_SRC } from "@/assets/darbContactAdvisor";
import { SUPPORT_EMAIL, whatsappBusinessUrl } from "@/lib/contactConfig";

const ContactHero = () => {
  const { t, i18n } = useTranslation(["contact", "common"]);
  const whatsappMessage = i18n.language.startsWith("ar")
    ? "مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا."
    : "Hi, I would like to talk to DARB about studying in Germany.";

  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="container relative z-10 grid min-h-[480px] items-center gap-8 py-12 lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("contactHero.eyebrow")}</p>
          <h1 className="mt-4 text-balance font-editorial text-5xl leading-none text-primary sm:text-6xl lg:text-7xl">{t("common:pageHero.contact.title", "Contact")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">{t("contactHero.subtitle")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><a href={whatsappBusinessUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("support.whatsapp")}</a></Button>
            <Button asChild size="lg" variant="outline"><a href={`mailto:${SUPPORT_EMAIL}`}><Mail />{SUPPORT_EMAIL}</a></Button>
          </div>
          <Link to="/ai-advisor" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary underline decoration-brand/50 underline-offset-4 hover:decoration-brand">
            <Sparkles className="size-4 text-brand-strong" />
            {t("contactHero.aiLink")}
          </Link>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          <div className="aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-lg border border-border bg-editorial-paper shadow-surface-lg">
            <img src={DARB_CONTACT_ADVISOR_SRC} alt={t("contactHero.imageAlt")} className="h-full w-full object-cover" fetchPriority="high" />
          </div>
          <span className="darb-spectrum darb-spectrum-lg block rounded-none" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};

export default ContactHero;