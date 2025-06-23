
import React, { useState, useM } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { majorsData, SubMajor } from '@/data/majorsData';
import MajorModal from '@/components/educational/MajorModal';
import MajorCard from '@/components/educational/MajorCard';
import HeroSection from '@/components/educational/HeroSection';
import SearchAndFilter from '@/components/educational/SearchAndFilter';
import NoResults from '@/components/educational/NoResults';
import CTASection from '@/components/educational/CTASection';

const EducationalProgramsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMajor, setSelectedMajor] = useState<SubMajor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Flatten all submajors for search and display
  const allSubMajors = useMemo(() => {
    const flattened: (SubMajor & { categoryTitle: string; categoryId: string })[] = [];
    majorsData.forEach(category => {
      category.subMajors.forEach(subMajor => {
        flattened.push({
          ...subMajor,
          categoryTitle: category.title,
          categoryId: category.id
        });
      });
    });
    return flattened;
  }, []);

  // Filter majors based on search query and selected category
  const filteredMajors = useMemo(() => {
    let filtered = allSubMajors;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(major => major.categoryId === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(major => 
        major.nameAR.toLowerCase().includes(query) ||
        major.description.toLowerCase().includes(query) ||
        major.categoryTitle.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allSubMajors, searchQuery, selectedCategory]);

  // Calculate major counts per category
  const categoryMajorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    majorsData.forEach(category => {
      counts[category.id] = category.subMajors.length;
    });
    return counts;
  }, []);

  const handleMajorClick = (major: SubMajor) => {
    setSelectedMajor(major);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMajor(null);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />

      <HeroSection />

      <SearchAndFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filteredMajorsCount={filteredMajors.length}
        allMajorsCount={allSubMajors.length}
        categoryMajorCounts={categoryMajorCounts}
      />

      {/* Results Section */}
      <section className="educational-content-spacing py-6 md:py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {filteredMajors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredMajors.map((major) => (
                  <MajorCard
                    key={major.id}
                    major={major}
                    onMajorClick={handleMajorClick}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            ) : (
              <NoResults
                onClearSearch={() => setSearchQuery('')}
                onClearCategory={() => setSelectedCategory(null)}
              />
            )}
          </div>
        </div>
      </section>

      <CTASection />

      {/* Major Detail Modal */}
      <MajorModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        major={selectedMajor}
      />

      <Footer />
    </div>
  );
};

export default EducationalProgramsPage;
