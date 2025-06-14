
import { CheckCircle } from "lucide-react";

const keyPoints = [
  "Based in Germany, Jordan, and Romania",
  "Serving local and international students",
  "Multilingual team (Arabic, English, German)",
  "Transparent pricing and trusted partners",
];

const About = () => {
  return (
    <section id="about" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Who We Are</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Darb Study International is a student-focused educational consultancy helping students from the Middle East and beyond to study in Europe — particularly Germany, Romania, and Jordan. We offer personalized, full-process support with a 97% success rate and a passion for student success.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            {keyPoints.map((point, index) => (
              <div key={index} className="flex items-start space-x-3">
                <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <p className="text-md">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
