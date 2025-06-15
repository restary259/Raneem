
import { Button } from "@/components/ui/button";
import HeroScene from "./HeroScene";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Hero = () => {
  const { t } = useTranslation();

  return (
    <section className="relative h-[80vh] min-h-[500px] flex items-center justify-center text-white overflow-hidden">
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
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center text-center px-4">
        <div className="w-full h-1/2 min-h-[200px]">
          <HeroScene />
        </div>
        <p className="mt-4 text-lg md:text-xl max-w-3xl mx-auto">
          {t('hero.subtitle')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" asChild variant="accent">
            <Link to="/contact">{t('hero.free_consultation')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/contact">{t('hero.apply_now')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
