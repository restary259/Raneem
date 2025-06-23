
import React, { useState, useMemo } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, GraduationCap, BookOpen } from 'lucide-react';
import { majorsData, SubMajor, MajorCategory } from '@/data/majorsData';

const EducationalProgramsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Flatten all submajors for search
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

  // Filter submajors based on search query
  const filteredSubMajors = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    return allSubMajors.filter(subMajor => 
      subMajor.nameAR.toLowerCase().includes(query) ||
      subMajor.description.toLowerCase().includes(query) ||
      (subMajor.nameDE && subMajor.nameDE.toLowerCase().includes(query))
    );
  }, [searchQuery, allSubMajors]);

  // Filter categories to show only those with matching results
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return majorsData;
    
    const matchingCategoryIds = new Set(filteredSubMajors.map(sub => sub.categoryId));
    return majorsData.filter(category => matchingCategoryIds.has(category.id));
  }, [searchQuery, filteredSubMajors]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-orange-200 text-orange-800 rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-orange-50 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 bg-orange-100 text-orange-800">
              اكتشف تخصصك المثالي
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              التخصصات الأكاديمية
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              استكشف مجموعة واسعة من التخصصات الأكاديمية واختر المسار المهني الذي يناسب طموحاتك
            </p>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="py-8 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="ابحث في التخصصات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-14 text-lg border-2 border-gray-200 focus:border-orange-500 rounded-xl"
                dir="rtl"
              />
            </div>
            {searchQuery && (
              <p className="text-sm text-gray-600 mt-2 text-center">
                تم العثور على {filteredSubMajors.length} تخصص
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Search Results */}
      {searchQuery && filteredSubMajors.length > 0 && (
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6 text-center">نتائج البحث</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {filteredSubMajors.map((subMajor) => (
                <Card key={subMajor.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <BookOpen className="h-6 w-6 text-orange-500 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-2">
                          {highlightText(subMajor.nameAR, searchQuery)}
                        </h3>
                        <Badge variant="outline" className="mb-3 text-xs">
                          {subMajor.categoryTitle}
                        </Badge>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {highlightText(subMajor.description, searchQuery)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories Section */}
      {(!searchQuery || filteredCategories.length > 0) && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <Accordion type="multiple" className="space-y-4">
                {(searchQuery ? filteredCategories : majorsData).map((category) => (
                  <AccordionItem 
                    key={category.id} 
                    value={category.id}
                    className="border rounded-lg bg-white shadow-sm"
                  >
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                      <div className="flex items-center gap-4 w-full">
                        <GraduationCap className="h-6 w-6 text-orange-500" />
                        <div className="flex-1 text-right">
                          <h2 className="text-xl font-bold">
                            {highlightText(category.title, searchQuery)}
                          </h2>
                          <p className="text-sm text-gray-600 mt-1">
                            {category.subMajors.length} تخصص متاح
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {category.subMajors
                          .filter(subMajor => 
                            !searchQuery || 
                            subMajor.nameAR.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            subMajor.description.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((subMajor) => (
                          <Card key={subMajor.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-3 h-3 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                                <div className="flex-1">
                                  <h3 className="font-semibold mb-2">
                                    {highlightText(subMajor.nameAR, searchQuery)}
                                  </h3>
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    {highlightText(subMajor.description, searchQuery)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      )}

      {/* No Results */}
      {searchQuery && filteredSubMajors.length === 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-md mx-auto">
              <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                لم يتم العثور على نتائج
              </h3>
              <p className="text-gray-500 mb-6">
                جرب البحث بكلمات مختلفة أو تصفح التخصصات أدناه
              </p>
              <Button 
                onClick={() => setSearchQuery('')}
                className="bg-orange-500 hover:bg-orange-600"
              >
                تصفح جميع التخصصات
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-orange-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            هل تحتاج مساعدة في اختيار التخصص؟
          </h2>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto opacity-90">
            احجز استشارة مجانية مع خبرائنا التعليميين لمساعدتك في اختيار التخصص المناسب لميولك وقدراتك
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100">
              احجز استشارة مجانية
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              اختبار التخصص
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default EducationalProgramsPage;
