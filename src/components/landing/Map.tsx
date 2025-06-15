
import React from 'react';

const Map = () => {
  const addressQuery = "Tamra Mall, Tamra, 3081100, Israel";
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(addressQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <iframe
      src={mapSrc}
      className="w-full h-full border-0"
      allowFullScreen={false}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title="موقع المكتب"
    />
  );
};

export default Map;
