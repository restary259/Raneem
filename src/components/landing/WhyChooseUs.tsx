
import { CheckCircle } from "lucide-react";

const reasons = [
  "1-on-1 support in Arabic & English",
  "Fast processing with minimal paperwork",
  "Trusted by 100+ students",
  "Affordable & transparent pricing",
  "Located in 3 countries for easier access",
];

const WhyChooseUs = () => {
  return (
    <section id="why-us" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Why Choose Darb?</h2>
        </div>
        <div className="mt-12 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {reasons.map((reason, index) => (
            <div key={index} className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
              <p className="text-lg">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
