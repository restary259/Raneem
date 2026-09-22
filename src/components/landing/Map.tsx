
import { useTranslation } from 'react-i18next';

const Map = () => {
  const { t } = useTranslation('contact');
  const addressQuery = "Tamra Mall, Tamra 3081100";
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(addressQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <iframe
      src={mapSrc}
      className="w-full h-full border-0"
      allowFullScreen={false}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title={t('contact.mapFrameTitle')}
    />
  );
};

export default Map;
