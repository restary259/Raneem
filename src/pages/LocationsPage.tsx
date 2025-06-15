
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Locations from "@/components/landing/Locations";

const LocationsPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <Locations />
      </main>
      <Footer />
    </div>
  );
};

export default LocationsPage;
