
import AboutIntro from '../about/AboutIntro';
import KeyFeatures from '../about/KeyFeatures';
import TeamSection from '../about/TeamSection';
import CeoMessage from '../about/CeoMessage';
import PartnersCarousel from '../about/PartnersCarousel';
import CallToAction from '../about/CallToAction';

const About = () => {
  return (
    <div className="bg-background">
      <AboutIntro />
      <KeyFeatures />
      <TeamSection />
      <CeoMessage />
      <PartnersCarousel />
      <CallToAction />
    </div>
  );
};

export default About;
