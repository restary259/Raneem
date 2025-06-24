import React, { useState } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Building2, Heart } from 'lucide-react';
import CountrySelector from '@/components/educational/CountrySelector';
import UniversityCard from '@/components/educational/UniversityCard';
import LanguageSchoolCard from '@/components/educational/LanguageSchoolCard';
import ServiceCard from '@/components/educational/ServiceCard';
import { countries, universities, languageSchools, services } from '@/data/educationalDestinations';
const EducationalDestinationsPage = () => {
  const [selectedCountry, setSelectedCountry] = useState('germany');
  return <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-orange-50 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 bg-orange-100 text-orange-800">
              اكتشف وجهتك التعليمية المثالية
            </Badge>
            <h1 className="text-5xl font-bold text-foreground mb-6">
              وجهاتنا التعليمية
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              استكشف أفضل الجامعات ومعاهد اللغة والخدمات التعليمية في أوروبا والشرق الأوسط
            </p>
          </div>
        </div>
      </section>

      <CountrySelector countries={countries} selectedCountry={selectedCountry} onCountrySelect={setSelectedCountry} />

      <div className="container mx-auto px-4">
        {/* Universities */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <GraduationCap className="h-8 w-8 text-orange-500" />
            الجامعات الرائدة
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {universities[selectedCountry as keyof typeof universities]?.map((uni, index) => <UniversityCard key={index} university={uni} />)}
          </div>
        </div>

        {/* Language Schools */}
        {languageSchools[selectedCountry as keyof typeof languageSchools] && <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
              <Building2 className="h-8 w-8 text-orange-500" />
              معاهد اللغة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {languageSchools[selectedCountry as keyof typeof languageSchools].map((school, index) => <LanguageSchoolCard key={index} school={school} />)}
            </div>
          </div>}

        {/* Services */}
        {services[selectedCountry as keyof typeof services] && <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
              <Heart className="h-8 w-8 text-orange-500" />
              الخدمات الطلابية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {services[selectedCountry as keyof typeof services].map((service, index) => <ServiceCard key={index} service={service} />)}
            </div>
          </div>}
      </div>

      {/* CTA Section */}
      <section className="py-20 text-white bg-slate-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            مستعد لبدء رحلتك التعليمية؟
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            احجز استشارة مجانية مع خبرائنا لمساعدتك في اختيار الوجهة والتخصص المناسب لك
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white hover:bg-gray-100 text-zinc-950">
              احجز استشارة مجانية
            </Button>
            <Button size="lg" variant="outline" className="border-white text-slate-950 bg-slate-50">
              تحدث مع مستشار
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>;
};
export default EducationalDestinationsPage;