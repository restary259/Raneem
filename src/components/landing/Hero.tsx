
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AnimatedCounter from "./AnimatedCounter";

const Hero = () => {
  const { t } = useTranslation();
  return (
    <section className="relative h-screen min-h-[700px] flex items-center justify-center text-white overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover"
      >
        <source
          src="https://videos.pexels.com/video-files/3209828/3209828-hd_1920_1080_25fps.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
      <div className="absolute inset-0 bg-primary/80 backdrop-blur-sm" />
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center text-center px-4">
        <h1 className="text-5xl md:text-7xl font-bold text-shadow-lg animate-fade-in">
          رفيقك الدراسي العالمي
        </h1>
        <p className="mt-8 text-lg md:text-xl max-w-3xl mx-auto text-shadow-lg">
          {t('hero.subtitle')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row-reverse justify-center gap-4">
          <Button size="lg" asChild variant="accent" className="transition-transform duration-300 hover:scale-105">
            <Link to="/contact">{t('hero.consultation')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="border-white/50 text-white hover:bg-white/10 transition-colors hover:text-white transition-transform duration-300 hover:scale-105">
            <Link to="/contact">{t('applyNow')}</Link>
          </Button>
        </div>

        <div className="absolute bottom-10 left-0 right-0">
            <div className="container mx-auto grid grid-cols-3 gap-8 text-white animate-fade-in animation-delay-500">
                <AnimatedCounter value={1200} label="طالب سعيد" />
                <AnimatedCounter value={300} label="شريك تعليمي" />
                <AnimatedCounter value={15} label="دولة حول العالم" />
            </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
