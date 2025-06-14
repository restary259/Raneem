
import React, { useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [token, setToken] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);
  const { toast } = useToast();

  const locations = [
    { lng: 10.4515, lat: 51.1657, description: 'ألمانيا' }, // Germany
    { lng: 35.9284, lat: 31.9632, description: 'الأردن' }, // Jordan
    { lng: 25.0136, lat: 45.9432, description: 'رومانيا' }, // Romania
  ];

  const initializeMap = () => {
    if (map.current || !mapContainer.current || !token.trim()) {
        if(!token.trim()) {
            toast({ title: "خطأ", description: "الرجاء إدخال مفتاح Mapbox.", variant: "destructive" });
        }
        return;
    }

    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [25, 40],
      zoom: 3,
    });

    map.current.on('load', () => {
        locations.forEach(loc => {
            new mapboxgl.Marker()
                .setLngLat([loc.lng, loc.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(loc.description))
                .addTo(map.current!);
        });
    });

    setIsTokenSet(true);
    toast({ title: "تم تهيئة الخريطة!", description: "يمكنك الآن التفاعل مع الخريطة." });
  };
  
  if (!isTokenSet) {
    return (
        <div className="bg-background p-6 rounded-lg shadow-md flex flex-col gap-4 text-right">
            <h3 className="text-xl font-semibold">إعداد الخريطة التفاعلية</h3>
            <p className="text-muted-foreground">
                لعرض الخريطة، يرجى إدخال مفتاح الوصول العام الخاص بك من Mapbox. يمكنك الحصول عليه مجانًا من <a href="https://account.mapbox.com/access-tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline">موقع Mapbox</a>.
            </p>
            <Input 
                placeholder="ادخل مفتاح Mapbox هنا"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                dir="ltr"
            />
            <Button onClick={initializeMap} disabled={!token.trim()} variant="accent">
                عرض الخريطة
            </Button>
        </div>
    )
  }

  return <div ref={mapContainer} className="h-96 w-full rounded-lg" />;
};

export default Map;
