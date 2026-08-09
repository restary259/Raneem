import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

type Student = { name: string; destination: string; image: string };

const StudentGallery = () => {
  const { t } = useTranslation('landing');
  const isMobile = useIsMobile();
  const trackRef = useRef<HTMLDivElement>(null);
  const gallery = t('studentGallery', { returnObjects: true }) as { title: string; subtitle: string; students: Student[] };

  // Gentle auto-scroll on mobile, pauses as soon as the user interacts.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !isMobile) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let paused = false;
    let raf = 0;
    const pause = () => { paused = true; };
    const resume = () => { window.setTimeout(() => { paused = false; }, 4000); };

    el.addEventListener('pointerdown', pause);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('pointerup', resume);
    el.addEventListener('touchend', resume, { passive: true });

    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      if (!paused && dt < 100) {
        // scrollLeft is negative in RTL on modern browsers; direction follows sign.
        const rtl = getComputedStyle(el).direction === 'rtl';
        const delta = (dt / 1000) * 24 * (rtl ? -1 : 1);
        const max = el.scrollWidth - el.clientWidth;
        const atEnd = rtl ? Math.abs(el.scrollLeft) >= max - 2 : el.scrollLeft >= max - 2;
        if (atEnd) {
          el.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          el.scrollLeft += delta;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('pointerup', resume);
      el.removeEventListener('touchend', resume);
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
          ? "shrink-0 w-[78vw] max-w-[320px] snap-center overflow-hidden rounded-lg shadow-lg"
          : "group overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
      }
    >
      <div className="relative bg-secondary">
        <img
          src={student.image}
          alt={student.name ? `${student.name} — Darb student now studying in ${student.destination}` : `Darb student success story in ${student.destination}`}
          className="w-full h-56 sm:h-64 lg:h-80 object-contain object-center md:group-hover:scale-110 transition-transform duration-500"
          loading={index < 2 ? "eager" : "lazy"}
          fetchPriority={index < 2 ? "high" : "low"}
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 end-0 p-6 text-white text-end">
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
          className="mt-8 md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
