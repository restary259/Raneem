import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ExternalLink, Globe2 } from "lucide-react";
import { Link, useParams } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useDirection } from "@/hooks/useDirection";

type ExamDefinition = {
  id: string;
  label: string;
  subtitle: string;
  language: string;
  purpose: string;
  website: string;
};

const exams: Record<string, ExamDefinition> = {
  telc: { id: "telc", label: "telc", subtitle: "German language exams", language: "German", purpose: "Language certification", website: "https://www.telc.net/en/" },
  testdaf: { id: "TestDaF", label: "TestDaF", subtitle: "German for university", language: "German", purpose: "German for university", website: "https://www.testdaf.de/" },
  testas: { id: "TestAS", label: "TestAS", subtitle: "Academic aptitude test", language: "German / English", purpose: "Academic aptitude", website: "https://www.testas.de/en/" },
  onset: { id: "onSET", label: "onSET", subtitle: "Online language placement", language: "German / English", purpose: "Online language placement", website: "https://www.onset.de/" },
  dsh: { id: "DSH", label: "DSH", subtitle: "University entrance language exam", language: "German", purpose: "University entrance language exam", website: "https://www.fadaf.de/dsh/" },
  goethe: { id: "Goethe", label: "Goethe-Zertifikat", subtitle: "German language certificate", language: "German", purpose: "German language certificate", website: "https://www.goethe.de/en/spr/kup/prf.html" },
  ielts: { id: "IELTS", label: "IELTS", subtitle: "English language test", language: "English", purpose: "English language test", website: "https://ielts.org/" },
  toefl: { id: "TOEFL", label: "TOEFL", subtitle: "English language test", language: "English", purpose: "English language test", website: "https://www.ets.org/toefl.html" },
};

const ExamDetailPage = () => {
  const { t } = useTranslation("landing");
  const { isRtl } = useDirection();
  const { exam = "" } = useParams<{ exam?: string }>();
  const definition = exams[exam.toLowerCase()] ?? exams.testdaf;
  const examDetails = t("homepage.languagePrep.exams", { returnObjects: true }) as Record<string, { label: string; description: string }>;
  const detail = examDetails[definition.id];
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      <Header />
      <main className="pt-4 lg:pt-[var(--darb-header-height)]">
        <section className="border-b border-border bg-editorial-paper">
          <div className="container py-10 sm:py-14">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BackArrow className="h-4 w-4" />
              {t("homepage.examDetail.back")}
            </Link>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.55fr] lg:items-end">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">
                  {t("homepage.languagePrep.examEyebrow")}
                </p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                  {definition.label}
                </h1>
                <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
                  {detail?.description ?? definition.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background p-4">
                  <Globe2 className="h-5 w-5 text-brand-strong" />
                  <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Language</p>
                  <p className="mt-1 text-sm font-bold text-primary">{definition.language}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <BookOpen className="h-5 w-5 text-brand-strong" />
                  <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Focus</p>
                  <p className="mt-1 text-sm font-bold text-primary">{definition.purpose}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background py-12 sm:py-16">
          <div className="container grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-2xl border border-border bg-background p-6 shadow-surface sm:p-8">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-brand-strong">
                {t("homepage.examDetail.overview")}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-primary">{definition.label}</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                {detail?.description ?? definition.subtitle}
              </p>

              <div className="mt-8 border-t border-border pt-6">
                <h3 className="text-lg font-bold text-primary">{t("homepage.examDetail.support")}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[detail?.description ?? definition.subtitle, t("homepage.languagePrep.examCta")].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-xl bg-editorial-paper p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" />
                      <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <aside className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-brand">
                {t("homepage.examDetail.official")}
              </p>
              <h2 className="mt-2 text-2xl font-bold">{definition.label}</h2>
              <p className="mt-4 text-sm leading-7 text-primary-foreground/70">
                {t("homepage.examDetail.note")}
              </p>
              <a
                href={definition.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-between gap-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("homepage.examDetail.officialCta")}
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            </aside>
          </div>
        </section>

        <section className="border-t border-border bg-editorial-paper py-12 sm:py-16">
          <div className="container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-brand-strong">{t("homepage.examDetail.assessment")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("homepage.languagePrep.body")}</p>
            </div>
            <Link
              to="/apply"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t("homepage.examDetail.assessmentCta")}
              <ForwardArrow className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ExamDetailPage;
