
import AboutIntro from '../about/AboutIntro';
import KeyFeatures from '../about/KeyFeatures';
import TeamSection from '../about/TeamSection';
import CeoMessage from '../about/CeoMessage';
import CallToAction from '../about/CallToAction';
import ServiceProcess from '../services/ServiceProcess';

const About = () => {
  return (
    <div className="bg-background">
      <AboutIntro />
      <KeyFeatures />
      <ServiceProcess
        title="منهجية عملنا وضمان الجودة"
        description="نتبع عملية شفافة ومنظمة لضمان تجربة استثنائية وأفضل النتائج لكل طالب."
        className="bg-secondary/20"
      />
      <TeamSection />
      <CeoMessage />
      <CallToAction />
    </div>
  );
};

export default About;
