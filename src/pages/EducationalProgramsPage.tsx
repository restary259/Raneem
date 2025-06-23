
import React, { useState, useMemo } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, Filter, ChevronDown } from 'lucide-react';
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

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Close filters when clicking outside
  const handleOverlayClick = () => {
    if (showFilters) {
      setShowFilters(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />

      {/* Hero Section */}
      <section className="py-8 md:py-12 bg-gradient-to-b from-orange-50 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 bg-orange-100 text-orange-800 text-xs md:text-sm">
              اكتشف تخصصك المثالي
            </Badge>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              التخصصات الأكاديمية
            </h1>
            <p className="text-sm md:text-base lg:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
              استكشف مجموعة واسعة من التخصصات الأكاديمية واختر المسار المهني الذي يناسب طموحاتك
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section - Fixed with proper spacing */}
      <section className="sticky top-14 md:top-16 z-40 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
              <Input
                type="text"
                placeholder="ابحث في التخصصات الأكاديمية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4 pr-10 h-10 md:h-12 text-sm md:text-base border-2 border-gray-200 focus:border-orange-500 rounded-lg bg-gray-50 focus:bg-white transition-colors"
                dir="rtl"
              />
            </div>

            {/* Filter Section with Dropdown */}
            <div className="flex items-center justify-between">
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={toggleFilters}
                  className="flex items-center gap-2 text-sm md:text-base px-3 md:px-4 py-2 border-2 border-gray-200 hover:border-orange-500 transition-colors"
                  aria-expanded={showFilters}
                  aria-haspopup="true"
                >
                  <Filter className="h-4 w-4" />
                  تصفية حسب الفئة
                  <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </Button>

                {/* Filter Dropdown */}
                {showFilters && (
                  <>
                    {/* Overlay for mobile */}
                    <div 
                      className="fixed inset-0 z-30 md:hidden" 
                      onClick={handleOverlayClick}
                      aria-hidden="true"
                    />
                    
                    {/* Dropdown Content */}
                    <div className="absolute top-full mt-2 left-0 right-0 md:right-auto md:w-96 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      <div className="p-4 space-y-2">
                        <Button
                          variant={selectedCategory === null ? "default" : "outline"}
                          onClick={() => {
                            setSelectedCategory(null);
                            setShowFilters(false);
                          }}
                          className={`w-full justify-between text-sm ${
                            selectedCategory === null 
                              ? "bg-orange-500 hover:bg-orange-600 text-white" 
                              : "text-gray-600 hover:text-orange-600 hover:border-orange-500"
                          }`}
                        >
                          <span>جميع التخصصات</span>
                          <Badge variant="secondary" className="mr-2">
                            {Object.values(categoryMajorCounts).reduce((sum, count) => sum + count, 0)}
                          </Badge>
                        </Button>
                        
                        {majorsData.map((category) => (
                          <Button
                            key={category.id}
                            variant={selectedCategory === category.id ? "default" : "outline"}
                            onClick={() => {
                              setSelectedCategory(category.id);
                              setShowFilters(false);
                            }}
                            className={`w-full justify-between text-sm ${
                              selectedCategory === category.id 
                                ? "bg-orange-500 hover:bg-orange-600 text-white" 
                                : "text-gray-600 hover:text-orange-600 hover:border-orange-500"
                            }`}
                          >
                            <span>{category.title}</span>
                            <Badge variant="secondary" className="mr-2">
                              {categoryMajorCounts[category.id] || 0}
                            </Badge>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Results Count */}
              <div className="text-xs md:text-sm text-gray-600">
                {searchQuery || selectedCategory ? (
                  <>تم العثور على {filteredMajors.length} تخصص</>
                ) : (
                  <>{allSubMajors.length} تخصص متاح</>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section - Proper top padding to account for sticky header */}
      <section className="py-6 md:py-8" style={{ paddingTop: 'clamp(1rem, 3vw, 2rem)' }}>
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
              /* No Results */
              <div className="text-center py-12 md:py-16">
                <div className="max-w-md mx-auto">
                  <BookOpen className="h-12 w-12 md:h-16 md:w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-gray-600 mb-2">
                    لم يتم العثور على نتائج
                  </h3>
                  <p className="text-sm md:text-base text-gray-500 mb-6">
                    جرب البحث بكلمات مختلفة أو اختر فئة أخرى
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      onClick={() => setSearchQuery('')}
                      className="bg-orange-500 hover:bg-orange-600 text-sm md:text-base px-4 md:px-6"
                    >
                      مسح البحث
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedCategory(null)}
                      className="border-orange-500 text-orange-500 hover:bg-orange-50 text-sm md:text-base px-4 md:px-6"
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
      <section className="py-12 md:py-16 bg-orange-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4 md:mb-6">
            هل تحتاج مساعدة في اختيار التخصص؟
          </h2>
          <p className="text-sm md:text-base lg:text-lg mb-6 md:mb-8 max-w-2xl mx-auto opacity-90 leading-relaxed">
            احجز استشارة مجانية مع خبرائنا التعليميين لمساعدتك في اختيار التخصص المناسب لميولك وقدراتك
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
            <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100 px-6 md:px-8 text-sm md:text-base">
              احجز استشارة مجانية
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-6 md:px-8 text-sm md:text-base">
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
