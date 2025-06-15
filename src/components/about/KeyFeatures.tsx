
import { CheckCircle, Users, Wallet, MapPin, Handshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const icons = {
  CheckCircle,
  Users,
  Wallet,
  Handshake,
  MapPin,
};

const iconMap: (keyof typeof icons)[] = ["CheckCircle", "Users", "Wallet", "Handshake", "MapPin"];

const KeyFeatures = () => {
  const { t } = useTranslation();
  const features = t('keyFeatures.features', { returnObjects: true }) as { text: string }[];
  
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 text-center max-w-5xl mx-auto">
          {Array.isArray(features) && features.map((feature, index) => {
            const Icon = icons[iconMap[index]];
            if (!Icon) return null;
            return (
              <div key={index} className="flex flex-col items-center p-4">
                <Icon className="h-12 w-12 text-accent mb-4" strokeWidth={1.5} />
                <p className="text-md font-semibold text-primary">{feature.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
export default KeyFeatures;
