
import React, { useState, useMemo } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, Filter } from 'lucide-react';
import { majorsData, SubMajor } from '@/data/majorsData';
import MajorModal from '@/components/educational/MajorModal';
import CategoryFilter from '@/components/educational/CategoryFilter';
import MajorCard from '@/components/educational/MajorCard';

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

      {/* Hero Section */}
      <section className="py-12 md:py-16 bg-gradient-to-b from-orange-50 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 bg-orange-100 text-orange-800">
              اكتشف تخصصك المثالي
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              التخصصات الأكاديمية
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              استكشف مجموعة واسعة من التخصصات الأكاديمية واختر المسار المهني الذي يناسب طموحاتك
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-8 bg-white border-b sticky top-16 z-30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="ابحث في التخصصات الأكاديمية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-12 text-lg border-2 border-gray-200 focus:border-orange-500 rounded-xl bg-gray-50 focus:bg-white transition-colors"
                dir="rtl"
              />
            </div>

            {/* Filter Toggle Button (Mobile) */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                الفئات
              </Button>
              
              {/* Results Count */}
              <div className="text-sm text-gray-600">
                {searchQuery || selectedCategory ? (
                  <>تم العثور على {filteredMajors.length} تخصص</>
                ) : (
                  <>{allSubMajors.length} تخصص متاح</>
                )}
              </div>
            </div>

            {/* Category Filters */}
            <div className={`${showFilters || !searchQuery ? 'block' : 'hidden'} md:block`}>
              <CategoryFilter
                categories={majorsData}
                selectedCategory={selectedCategory}
                onCategorySelect={setSelectedCategory}
                categoryMajorCounts={categoryMajorCounts}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {filteredMajors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              /* No Results */
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    لم يتم العثور على نتائج
                  </h3>
                  <p className="text-gray-500 mb-6">
                    جرب البحث بكلمات مختلفة أو اختر فئة أخرى
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      onClick={() => setSearchQuery('')}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      مسح البحث
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedCategory(null)}
                      className="border-orange-500 text-orange-500 hover:bg-orange-50"
                    >
                      عرض جميع الفئات
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-orange-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
            هل تحتاج مساعدة في اختيار التخصص؟
          </h2>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto opacity-90">
            احجز استشارة مجانية مع خبرائنا التعليميين لمساعدتك في اختيار التخصص المناسب لميولك وقدراتك
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100 px-8">
              احجز استشارة مجانية
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8">
              اختبار التخصص
            </Button>
          </div>
        </div>
      </section>

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
