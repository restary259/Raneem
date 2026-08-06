
import React, { useState, useMemo } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { majorsData, SubMajor } from '@/data/majorsData';
import MajorModal from '@/components/educational/MajorModal';
import MajorCard from '@/components/educational/MajorCard';
import HeroSection from '@/components/educational/HeroSection';
import SearchAndFilter from '@/components/educational/SearchAndFilter';
import NoResults from '@/components/educational/NoResults';
import CTASection from '@/components/educational/CTASection';
import SEOHead from '@/components/common/SEOHead';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';

const EducationalProgramsPage = () => {
  const { dir } = useDirection();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMajor, setSelectedMajor] = useState<SubMajor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const allSubMajors = useMemo(() => {
    const flattened: (SubMajor & { categoryTitle: string; categoryTitleEN: string; categoryId: string })[] = [];
    majorsData.forEach(category => {
      category.subMajors.forEach(subMajor => {
        flattened.push({
          ...subMajor,
          categoryTitle: category.title,
          categoryTitleEN: category.titleEN,
          categoryId: category.id
        });
      });
    });
    return flattened;
  }, []);

  const filteredMajors = useMemo(() => {
    let filtered = allSubMajors;
    if (selectedCategory) {
      filtered = filtered.filter(major => major.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(major =>
        major.nameAR.toLowerCase().includes(query) ||
        major.nameEN.toLowerCase().includes(query) ||
        major.description.toLowerCase().includes(query) ||
        major.descriptionEN.toLowerCase().includes(query) ||
        major.categoryTitle.toLowerCase().includes(query) ||
        major.categoryTitleEN.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [allSubMajors, searchQuery, selectedCategory]);

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
    <div className="min-h-screen bg-background" dir={dir}>
      <SEOHead
        title={t('seo.edProgTitle')}
        description={t('seo.edProgDesc')}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: t('seo.edProgTitle'),
          description: t('seo.edProgDesc'),
          url: 'https://darb-agency.lovable.app/educational-programs',
          inLanguage: lang,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: allSubMajors.length,
            itemListElement: allSubMajors.slice(0, 30).map((major, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'Course',
                name: lang === 'ar' ? major.nameAR : major.nameEN,
                description: lang === 'ar' ? major.description : major.descriptionEN,
                provider: {
                  '@type': 'EducationalOrganization',
                  name: 'Darb Study Pathways',
                  url: 'https://darb-agency.lovable.app',
                },
              },
            })),
          },
        }}
      />
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
      <section className="educational-content-spacing py-6 md:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {filteredMajors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-1">
                {filteredMajors.map((major) => (
                  <MajorCard key={major.id} major={major} onMajorClick={handleMajorClick} searchQuery={searchQuery} />
                ))}
              </div>
            ) : (
              <NoResults onClearSearch={() => setSearchQuery('')} onClearCategory={() => setSelectedCategory(null)} />
            )}
          </div>
        </div>
      </section>
      <CTASection />
      <MajorModal isOpen={isModalOpen} onClose={handleCloseModal} major={selectedMajor} />
      <Footer />
    </div>
  );
};

export default EducationalProgramsPage;
