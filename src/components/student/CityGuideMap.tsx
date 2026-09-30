import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export interface CityGuideMapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  className?: string;
  pins: CityGuideMapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: { lat: number; lng: number };
}

let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    if (!key) return reject(new Error("Missing maps key"));
    w.__darbCityGuideMapInit = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__darbCityGuideMapInit&channel=${channel ?? ""}`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error("Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export default function CityGuideMap({ pins, selectedId, onSelect, center, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !el.current) return;
        const g = (window as any).google;
        map.current = new g.maps.Map(el.current, {
          center,
          zoom: 13,
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: true,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile markers whenever map readiness or pins change.
  useEffect(() => {
    if (!ready || !map.current) return;
    const g = (window as any).google;
    const next = new Set(pins.map((p) => p.id));
    markers.current.forEach((m, id) => {
      if (!next.has(id)) {
        m.setMap(null);
        markers.current.delete(id);
      }
    });
    pins.forEach((p) => {
      if (markers.current.has(p.id)) return;
      const m = new g.maps.Marker({ position: { lat: p.lat, lng: p.lng }, map: map.current, title: p.name });
      m.addListener("click", () => onSelect(p.id));
      markers.current.set(p.id, m);
    });
  }, [ready, pins, onSelect]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const g = (window as any).google;
    markers.current.forEach((m, id) => {
      m.setAnimation(id === selectedId ? g.maps.Animation.BOUNCE : null);
      if (id === selectedId) {
        map.current.panTo(m.getPosition());
        setTimeout(() => m.setAnimation(null), 1400);
      }
    });
  }, [ready, selectedId]);

  if (failed) return null;
  return <div ref={el} className={cn("h-[260px] w-full overflow-hidden rounded-lg border border-border bg-muted sm:h-[340px]", className)} />;
}
