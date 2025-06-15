
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const About = () => {
  const { t } = useTranslation(['about', 'common']);

  return (
    <section id="about" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 text-right animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold text-primary">{t('aboutIntro.title')}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{t('aboutIntro.subtitle')}</p>
            <p className="mt-6 text-muted-foreground">{t('aboutIntro.description_p1')}</p>
            <p className="mt-4 text-muted-foreground">{t('aboutIntro.description_p2')}</p>
            <Button asChild className="mt-8" variant="accent">
              <Link to="/about">{t('nav.about')}</Link>
            </Button>
          </div>
          <div className="order-1 md:order-2 animate-fade-in animation-delay-300">
            <img 
              src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
              alt="Team discussing a project"
              className="rounded-lg shadow-xl w-full h-auto object-cover aspect-video"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
