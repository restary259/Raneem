import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
const About = () => {
  const {
    t
  } = useTranslation(['about', 'common']);
  return <section id="about" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        
      </div>
    </section>;
};
export default About;