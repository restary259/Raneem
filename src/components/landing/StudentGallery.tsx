import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

type Student = { name: string; destination: string; image: string; focus?: string };

const StudentGallery = () => {
  const { t } = useTranslation('landing');
  const isMobile = useIsMobile();
  const trackRef = useRef<HTMLDivElement>(null);
  const gallery = t('studentGallery', { returnObjects: true }) as { title: string; subtitle: string; students: Student[] };

  // Gentle auto-advance on mobile; pauses while (and shortly after) the user swipes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !isMobile) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let pausedUntil = 0;
    const pause = () => { pausedUntil = Date.now() + 6000; };
    el.addEventListener('pointerdown', pause);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('wheel', pause, { passive: true });

    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil || document.hidden) return;
      const rtl = getComputedStyle(el).direction === 'rtl';
      const max = el.scrollWidth - el.clientWidth;
      const atEnd = Math.abs(el.scrollLeft) >= max - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const slide = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
        el.scrollBy({ left: (slide + 16) * (rtl ? -1 : 1), behavior: 'smooth' });
      }
    }, 3500);

    return () => {
      window.clearInterval(id);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('wheel', pause);
    };
  }, [isMobile]);

  if (!gallery || !Array.isArray(gallery.students)) {
    return null;
  }

  const renderCard = (student: Student, index: number, inCarousel: boolean) => (
    <Card
      key={index}
      className={
        inCarousel
          ? "shrink-0 w-[72vw] max-w-[300px] snap-center overflow-hidden rounded-lg shadow-lg"
          : "group overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
      }
    >
      <div className="relative aspect-[3/4] bg-secondary">
        <img
          src={student.image}
          alt={student.name ? `${student.name} — Darb student now studying in ${student.destination}` : `Darb student success story in ${student.destination}`}
          className="absolute inset-0 h-full w-full object-cover md:group-hover:scale-110 transition-transform duration-500"
          style={{ objectPosition: student.focus || '50% 40%' }}
          loading={inCarousel && index === 0 ? "eager" : "lazy"}
          fetchPriority={inCarousel && index === 0 ? "high" : "low"}

          decoding="async"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-0 end-0 p-4 sm:p-6 text-white text-end">
          {student.name ? <p className="text-lg font-semibold">{student.name}</p> : null}
          <p className="text-base font-light">{student.destination}</p>
        </div>
      </div>
    </Card>
  );

  return (
    <section id="student-gallery" className="py-12 md:py-24 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">{gallery.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{gallery.subtitle}</p>
        </div>

        {/* Mobile: swipeable carousel */}
        <div
          ref={trackRef}
          className="mt-8 md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-label={gallery.title}
        >
          {gallery.students.map((s, i) => renderCard(s, i, true))}
        </div>

        {/* Desktop / tablet: grid */}
        <div className="mt-12 hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {gallery.students.map((s, i) => renderCard(s, i, false))}
        </div>
      </div>
    </section>
  );
};

export default StudentGallery;
