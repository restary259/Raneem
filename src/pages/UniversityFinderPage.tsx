
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import UniversityFinder from '@/components/university-finder/UniversityFinder';

const UniversityFinderPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <UniversityFinder />
      </main>
      <Footer />
    </div>
  );
};

export default UniversityFinderPage;
