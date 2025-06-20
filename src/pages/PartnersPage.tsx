
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Users, GraduationCap, Award, ExternalLink, Calendar, Star, Globe } from 'lucide-react';

const PartnersPage = () => {
  const { t } = useTranslation('partners');

  const stats = [
    {
      icon: Users,
      number: '50+',
      label: 'شريك موثوق',
      description: 'جامعات ومؤسسات تعليمية'
    },
    {
      icon: MapPin,
      number: '15+',
      label: 'دولة',
      description: 'في جميع أنحاء العالم'
    },
    {
      icon: GraduationCap,
      number: '2000+',
      label: 'طالب',
      description: 'تم قبولهم بنجاح'
    },
    {
      icon: Award,
      number: '10+',
      label: 'سنوات خبرة',
      description: 'في التعليم الدولي'
    }
  ];

  const germanyUniversities = [
    {
      name: "جامعة ميونخ التقنية",
      englishName: "Technical University of Munich",
      logo: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=400",
      location: "ميونخ، ألمانيا",
      ranking: "#50 عالمياً",
      established: "1868",
      students: "45,000+",
      programs: ["هندسة", "علوم الحاسوب", "إدارة الأعمال", "الطب"],
      website: "https://www.tum.de",
      partnerSince: "2020"
    },
    {
      name: "جامعة هايدلبرغ",
      englishName: "Heidelberg University",
      logo: "https://images.unsplash.com/photo-1564981797816-1043664bf78d?w=400",
      location: "هايدلبرغ، ألمانيا",
      ranking: "#64 عالمياً",
      established: "1386",
      students: "30,000+",
      programs: ["الطب", "القانون", "العلوم الطبيعية", "الفلسفة"],
      website: "https://www.uni-heidelberg.de",
      partnerSince: "2019"
    },
    {
      name: "جامعة برلين الحرة",
      englishName: "Free University of Berlin",
      logo: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400",
      location: "برلين، ألمانيا",
      ranking: "#130 عالمياً",
      established: "1948",
      students: "35,000+",
      programs: ["العلوم السياسية", "الاقتصاد", "الطب", "الفيزياء"],
      website: "https://www.fu-berlin.de",
      partnerSince: "2021"
    }
  ];

  const canadaUniversities = [
    {
      name: "جامعة تورونتو",
      englishName: "University of Toronto",
      logo: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400",
      location: "تورونتو، كندا",
      ranking: "#21 عالمياً",
      established: "1827",
      students: "97,000+",
      programs: ["الطب", "الهندسة", "إدارة الأعمال", "الحقوق"],
      website: "https://www.utoronto.ca",
      partnerSince: "2018"
    },
    {
      name: "جامعة ماكجيل",
      englishName: "McGill University",
      logo: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400",
      location: "مونتريال، كندا",
      ranking: "#31 عالمياً",
      established: "1821",
      students: "40,000+",
      programs: ["الطب", "الهندسة", "العلوم", "الآداب"],
      website: "https://www.mcgill.ca",
      partnerSince: "2019"
    }
  ];

  const ukUniversities = [
    {
      name: "جامعة أكسفورد",
      englishName: "University of Oxford",
      logo: "https://images.unsplash.com/photo-1509909756405-be0199881695?w=400",
      location: "أكسفورد، المملكة المتحدة",
      ranking: "#2 عالمياً",
      established: "1096",
      students: "24,000+",
      programs: ["الطب", "القانون", "الهندسة", "الأعمال"],
      website: "https://www.ox.ac.uk",
      partnerSince: "2017"
    },
    {
      name: "إمبريال كوليدج لندن",
      englishName: "Imperial College London",
      logo: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400",
      location: "لندن، المملكة المتحدة",
      ranking: "#6 عالمياً",
      established: "1907",
      students: "17,000+",
      programs: ["الهندسة", "الطب", "العلوم الطبيعية", "إدارة الأعمال"],
      website: "https://www.imperial.ac.uk",
      partnerSince: "2018"
    }
  ];

  const UniversityCard = ({ university }: { university: any }) => (
    <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <img 
            src={university.logo} 
            alt={university.name}
            className="w-16 h-16 object-cover rounded-full"
          />
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            {university.ranking}
          </Badge>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">{university.name}</h3>
        <p className="text-gray-600 text-sm mb-3">{university.englishName}</p>
        
        <div className="flex items-center text-gray-500 mb-3">
          <MapPin className="w-4 h-4 mr-2" />
          <span className="text-sm">{university.location}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">تأسست:</span>
            <span className="font-medium mr-2">{university.established}</span>
          </div>
          <div>
            <span className="text-gray-500">الطلاب:</span>
            <span className="font-medium mr-2">{university.students}</span>
          </div>
        </div>
        
        <div className="mb-4">
          <h4 className="font-semibold text-gray-900 mb-2">التخصصات الرئيسية:</h4>
          <div className="flex flex-wrap gap-1">
            {university.programs.slice(0, 3).map((program: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {program}
              </Badge>
            ))}
            {university.programs.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{university.programs.length - 3}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <Calendar className="w-4 h-4 inline mr-1" />
            شريك منذ {university.partnerSince}
          </div>
          <Button size="sm" variant="outline" className="group-hover:bg-orange-600 group-hover:text-white">
            <ExternalLink className="w-4 h-4 mr-2" />
            زيارة الموقع
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 bg-orange-200 text-orange-800">
              شركاؤنا حول العالم
            </Badge>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              شبكة عالمية من الجامعات المرموقة
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              نفتخر بشراكتنا مع أفضل الجامعات والمؤسسات التعليمية في العالم لنوفر لك أفضل الفرص التعليمية
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <stat.icon className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {stat.number}
                  </div>
                  <div className="font-semibold text-gray-900 mb-1">
                    {stat.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {stat.description}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Universities Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              جامعاتنا الشريكة
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              تعرف على شبكتنا المتنوعة من الجامعات المرموقة في أفضل الوجهات التعليمية حول العالم
            </p>
          </div>

          <Tabs defaultValue="germany" className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList className="grid w-full max-w-md grid-cols-3 bg-white">
                <TabsTrigger value="germany" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                  🇩🇪 ألمانيا
                </TabsTrigger>
                <TabsTrigger value="canada" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                  🇨🇦 كندا
                </TabsTrigger>
                <TabsTrigger value="uk" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                  🇬🇧 بريطانيا
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="germany">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {germanyUniversities.map((university, index) => (
                  <UniversityCard key={index} university={university} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="canada">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {canadaUniversities.map((university, index) => (
                  <UniversityCard key={index} university={university} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="uk">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {ukUniversities.map((university, index) => (
                  <UniversityCard key={index} university={university} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Partner Benefits */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
              مزايا الشراكة مع درب
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">وصول مباشر للطلاب</h3>
                    <p className="text-gray-600">
                      اتصال مباشر مع آلاف الطلاب المؤهلين المهتمين بالدراسة في جامعتك
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Globe className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">تسويق عالمي</h3>
                    <p className="text-gray-600">
                      تسويق برامجك الأكاديمية لجمهور دولي واسع عبر منصاتنا المتعددة
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Award className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">دعم شامل</h3>
                    <p className="text-gray-600">
                      فريق متخصص لدعم عملية القبول والتسجيل وضمان تجربة سلسة للطلاب
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Star className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">جودة مضمونة</h3>
                    <p className="text-gray-600">
                      طلاب مؤهلون ومختارون بعناية يلبون معايير القبول الأكاديمية العالية
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-600 to-orange-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            هل تريد أن تصبح شريكاً معنا؟
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            انضم إلى شبكة شركائنا المتنامية وساعد في تحقيق أحلام الطلاب التعليمية حول العالم
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="bg-white text-orange-600 hover:bg-gray-100">
              سجل كشريك
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              اتصل بنا
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PartnersPage;
