
import { CheckCircle, Users, Wallet, MapPin, Handshake } from 'lucide-react';

const features = [
  { icon: CheckCircle, text: "دعم شامل من الأوراق حتى الوصول" },
  { icon: Users, text: "فرق متعددة اللغات (العربية، الإنجليزية، الألمانية)" },
  { icon: Wallet, text: "أسعار شفافة بدون رسوم خفية" },
  { icon: Handshake, text: "متابعة شخصية 1-on-1 طوال الرحلة" },
  { icon: MapPin, text: "مكاتب فعلية في برلين، عمان، وبوخارست" },
];

const KeyFeatures = () => (
  <section className="py-12 md:py-24">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-center max-w-5xl mx-auto">
        {features.map((feature, index) => (
          <div key={index} className="flex flex-col items-center p-4">
            <feature.icon className="h-12 w-12 text-accent mb-4" strokeWidth={1.5} />
            <p className="text-md font-semibold font-cairo text-primary">{feature.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
export default KeyFeatures;
