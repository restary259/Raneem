
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { majorsData } from '@/data/majorsData';

interface SearchAndFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  filteredMajorsCount: number;
  allMajorsCount: number;
  categoryMajorCounts: Record<string, number>;
}

const SearchAndFilter = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  showFilters,
  setShowFilters,
  filteredMajorsCount,
  allMajorsCount,
  categoryMajorCounts
}: SearchAndFilterProps) => {
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleOverlayClick = () => {
    if (showFilters) {
      setShowFilters(false);
    }
  };

  return (
    <section className="educational-sticky-section sticky bg-white border-b shadow-sm z-40">
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
            <div className="relative min-w-0">
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
                  <div className="filter-dropdown absolute top-full mt-2 left-0 right-0 md:right-auto md:w-96 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
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
                <>تم العثور على {filteredMajorsCount} تخصص</>
              ) : (
                <>{allMajorsCount} تخصص متاح</>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchAndFilter;
