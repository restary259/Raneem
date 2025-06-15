
import AboutIntro from '../about/AboutIntro';
import KeyFeatures from '../about/KeyFeatures';
import TeamSection from '../about/TeamSection';
import CeoMessage from '../about/CeoMessage';
import CallToAction from '../about/CallToAction';

const About = () => {
  return (
    <div className="bg-background">
      <AboutIntro />
      <KeyFeatures />
      <TeamSection />
      <CeoMessage />
      <CallToAction />
    </div>
  );
};

export default About;
