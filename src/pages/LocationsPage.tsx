
import Footer from "@/components/landing/Footer";
import Locations from "@/components/landing/Locations";
import { useIsMobile } from "@/hooks/use-mobile";

const LocationsPage = () => {
  const isMobile = useIsMobile();
  
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header is handled by MobileLayout */}
      <main className="flex-grow">
        <Locations />
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default LocationsPage;
