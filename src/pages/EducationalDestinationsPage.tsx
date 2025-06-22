
import React, { useState } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, GraduationCap, Building2, Heart, ExternalLink, Users, Award } from 'lucide-react';

const EducationalDestinationsPage = () => {
  const [selectedCountry, setSelectedCountry] = useState('germany');
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null);

  const countries = [
    { code: 'germany', name: 'ألمانيا', flag: '🇩🇪', color: 'bg-red-600' },
    { code: 'romania', name: 'رومانيا', flag: '🇷🇴', color: 'bg-blue-600' },
    { code: 'jordan', name: 'الأردن', flag: '🇯🇴', color: 'bg-green-600' }
  ];

  const universities = {
    germany: [
      {
        name: "RWTH Aachen University",
        location: "آخن، ألمانيا",
        logoUrl: "/lovable-uploads/19a7a716-743b-42f3-b98f-836a36a365d8.png",
        description: "جامعة تقنية رائدة في ألمانيا متخصصة في الهندسة والتكنولوجيا",
        majors: ["هندسة ميكانيكية", "هندسة كهربائية", "علوم حاسوب", "هندسة كيميائية"],
        ranking: "#1 في ألمانيا للتكنولوجيا",
        students: "45,000 طالب"
      },
      {
        name: "Technical University of Munich",
        location: "ميونخ، ألمانيا",
        logoUrl: "/lovable-uploads/28a02fa1-8618-4821-aa55-98152e26886a.png",
        description: "جامعة بحثية متميزة في التكنولوجيا والعلوم الطبيعية",
        majors: ["هندسة", "علوم طبيعية", "طب", "إدارة أعمال"],
        ranking: "Top 50 عالمياً",
        students: "42,000 طالب"
      },
      {
        name: "University of Heidelberg",
        location: "هايدلبرغ، ألمانيا",
        logoUrl: "/lovable-uploads/6cd7ab4d-f888-4ab4-92f1-3f3ca3905606.png",
        description: "أقدم جامعة في ألمانيا، متميزة في البحث العلمي",
        majors: ["طب", "قانون", "فلسفة", "علوم طبيعية"],
        ranking: "Top 100 عالمياً",
        students: "30,000 طالب"
      }
    ],
    romania: [
      {
        name: "Carol Davila University",
        location: "بوخارست، رومانيا",
        logoUrl: "/lovable-uploads/dfca3402-c6b9-4560-88d7-6e8c19f26ab4.png",
        description: "جامعة طبية رائدة في رومانيا",
        majors: ["طب بشري", "طب أسنان", "صيدلة", "تمريض"],
        ranking: "#1 في رومانيا للطب",
        students: "15,000 طالب"
      },
      {
        name: "Ovidius University",
        location: "كونستانتا، رومانيا",
        logoUrl: "/lovable-uploads/03767a14-eafc-4beb-8e8f-12a2491e4ee5.png",
        description: "جامعة شاملة مع برامج متنوعة",
        majors: ["هندسة", "اقتصاد", "قانون", "علوم إنسانية"],
        ranking: "Top 10 في رومانيا",
        students: "18,000 طالب"
      }
    ],
    jordan: [
      {
        name: "جامعة اليرموك",
        location: "إربد، الأردن",
        logoUrl: "/lovable-uploads/125fa6e2-60ae-4bd0-91bb-a2b2dc342ebd.png",
        description: "جامعة حكومية رائدة في الأردن",
        majors: ["هندسة", "تكنولوجيا معلومات", "فنون جميلة", "تربية"],
        ranking: "#2 في الأردن",
        students: "40,000 طالب"
      }
    ]
  };

  const languageSchools = {
    germany: [
      {
        name: "F+U Academy of Languages",
        location: "هايدلبرغ، ألمانيا",
        logoUrl: "/lovable-uploads/e7298181-bfde-4ee6-b5cb-a310ab735b61.png",
        description: "أكاديمية لغات متخصصة في تعليم الألمانية للطلاب الدوليين",
        programs: ["دورات مكثفة", "إعداد للجامعة", "دورات مسائية"]
      },
      {
        name: "Alpha Aktiv",
        location: "هايدلبرغ، ألمانيا",
        logoUrl: "/lovable-uploads/171c7fae-8d36-4d06-a429-e3726c4417b8.png",
        description: "معهد متخصص في تعليم اللغة الألمانية والتأهيل الجامعي",
        programs: ["دورات عامة", "تحضير للامتحانات", "برامج مهنية"]
      },
      {
        name: "GoAcademy",
        location: "دوسلدورف، ألمانيا",
        logoUrl: "/lovable-uploads/f66f6ad1-4686-44a0-8341-178c0bacebaf.png",
        description: "معهد لغات حديث يقدم برامج متنوعة",
        programs: ["لغة ألمانية", "لغة إنجليزية", "برامج مهنية"]
      }
    ]
  };

  const services = {
    germany: [
      {
        name: "Techniker Krankenkasse",
        logoUrl: "/lovable-uploads/fc80f423-4215-4afe-ab5f-60a784436ae5.png",
        type: "تأمين صحي",
        description: "شركة التأمين الصحي الرائدة في ألمانيا للطلاب"
      },
      {
        name: "Deutsche Bahn",
        logoUrl: "/lovable-uploads/c4ad72df-424f-4051-b509-d3e1253f49f2.png",
        type: "مواصلات",
        description: "شبكة السكك الحديدية الوطنية مع خصومات للطلاب"
      }
    ]
  };

  const educationalPrograms = {
    "إدارة أعمال": {
      description: "برنامج شامل يغطي جميع جوانب إدارة الأعمال الحديثة",
      majors: [
        {
          name: "إدارة أعمال دولية",
          description: "يركز على إدارة الشركات متعددة الجنسيات والتجارة الدولية، مع التركيز على الثقافات المختلفة والأسواق العالمية.",
          duration: "3-4 سنوات",
          career: "مدير شركة، مستشار أعمال، محلل مالي"
        },
        {
          name: "التمويل والمحاسبة",
          description: "يركز على الإدارة المالية، التحليل المالي، والمحاسبة الإدارية للشركات والمؤسسات المختلفة.",
          duration: "3-4 سنوات",
          career: "محاسب، مدير مالي، محلل استثمار"
        },
        {
          name: "التسويق الرقمي",
          description: "يجمع بين التسويق التقليدي والرقمي، مع التركيز على وسائل التواصل الاجتماعي والتجارة الإلكترونية.",
          duration: "3-4 سنوات",
          career: "أخصائي تسويق، مدير علامة تجارية، مدير وسائل التواصل"
        }
      ]
    },
    "هندسة": {
      description: "برامج هندسية متنوعة تغطي التطبيقات النظرية والعملية",
      majors: [
        {
          name: "هندسة ميكانيكية",
          description: "تصميم وتطوير الآلات والأنظمة الميكانيكية، بما في ذلك السيارات والطائرات والروبوتات.",
          duration: "4-5 سنوات",
          career: "مهندس تصميم، مهندس إنتاج، مهندس جودة"
        },
        {
          name: "هندسة كهربائية",
          description: "تصميم وتطوير الأنظمة الكهربائية والإلكترونية، من الدوائر البسيطة إلى شبكات الطاقة المعقدة.",
          duration: "4-5 سنوات",
          career: "مهندس كهرباء، مهندس إلكترونيات، مهندس طاقة"
        },
        {
          name: "هندسة مدنية",
          description: "تصميم وبناء البنية التحتية مثل الجسور، المباني، والطرق مع التركيز على الاستدامة.",
          duration: "4-5 سنوات",
          career: "مهندس إنشائي، مهندس مواصلات، مهندس بيئي"
        }
      ]
    },
    "طب": {
      description: "برامج طبية شاملة لإعداد الأطباء المتخصصين",
      majors: [
        {
          name: "طب بشري",
          description: "برنامج شامل لتعليم التشخيص والعلاج الطبي، مع التدريب العملي في المستشفيات.",
          duration: "6 سنوات",
          career: "طبيب عام، طبيب متخصص، طبيب طوارئ"
        },
        {
          name: "طب أسنان",
          description: "متخصص في صحة الفم والأسنان، مع التدريب على العلاجات والجراحات السنية المختلفة.",
          duration: "5-6 سنوات",
          career: "طبيب أسنان، جراح فم، أخصائي تقويم"
        },
        {
          name: "صيدلة",
          description: "دراسة الأدوية وتأثيراتها، مع التركيز على تطوير وتحضير الأدوية الجديدة.",
          duration: "5 سنوات",
          career: "صيدلي، باحث أدوية، مدير صيدلية"
        }
      ]
    }
  };

  const MajorPopup = ({ major }: { major: any }) => (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-right">{major.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 text-right">
        <p className="text-gray-600 text-lg leading-relaxed">{major.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2">مدة الدراسة</h4>
            <p className="text-orange-600">{major.duration}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">الفرص المهنية</h4>
            <p className="text-blue-600">{major.career}</p>
          </div>
        </div>
      </div>
    </DialogContent>
  );

  return (
    <div className="min-h-screen bg-background">
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

      {/* Country Selection */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-center mb-12">
            <div className="flex gap-4 p-2 bg-gray-100 rounded-full">
              {countries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => setSelectedCountry(country.code)}
                  className={`px-6 py-3 rounded-full transition-all duration-200 flex items-center gap-2 ${
                    selectedCountry === country.code
                      ? 'bg-orange-500 text-white shadow-lg'
                      : 'hover:bg-gray-200'
                  }`}
                >
                  <span className="text-2xl">{country.flag}</span>
                  <span className="font-medium">{country.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Educational Programs */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
              <GraduationCap className="h-8 w-8 text-orange-500" />
              البرامج التعليمية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {Object.entries(educationalPrograms).map(([program, data]) => (
                <Card key={program} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <h3 className="text-xl font-bold mb-4">{program}</h3>
                    <p className="text-gray-600 mb-4">{data.description}</p>
                    <div className="space-y-2">
                      {data.majors.map((major, index) => (
                        <Dialog key={index}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full hover:bg-orange-50 hover:border-orange-300"
                            >
                              {major.name}
                            </Button>
                          </DialogTrigger>
                          <MajorPopup major={major} />
                        </Dialog>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Universities */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
              <GraduationCap className="h-8 w-8 text-orange-500" />
              الجامعات الرائدة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {universities[selectedCountry as keyof typeof universities]?.map((uni, index) => (
                <Card key={index} className="hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center border">
                      <img 
                        src={uni.logoUrl} 
                        alt={uni.name}
                        className="h-16 w-auto object-contain"
                      />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{uni.name}</h3>
                    <p className="text-gray-600 flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4" />
                      {uni.location}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">{uni.description}</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-orange-500" />
                        <span>{uni.ranking}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span>{uni.students}</span>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">التخصصات المتاحة:</h4>
                        <div className="flex flex-wrap gap-1">
                          {uni.majors.map((major, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {major}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Language Schools */}
          {languageSchools[selectedCountry as keyof typeof languageSchools] && (
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
                <Building2 className="h-8 w-8 text-orange-500" />
                معاهد اللغة
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {languageSchools[selectedCountry as keyof typeof languageSchools].map((school, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center border">
                        <img 
                          src={school.logoUrl} 
                          alt={school.name}
                          className="h-12 w-auto object-contain"
                        />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{school.name}</h3>
                      <p className="text-gray-600 flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4" />
                        {school.location}
                      </p>
                      <p className="text-sm text-gray-600 mb-4">{school.description}</p>
                      
                      <div>
                        <h4 className="font-semibold mb-2">البرامج:</h4>
                        <div className="flex flex-wrap gap-1">
                          {school.programs.map((program, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {program}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {services[selectedCountry as keyof typeof services] && (
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
                <Heart className="h-8 w-8 text-orange-500" />
                الخدمات الطلابية
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {services[selectedCountry as keyof typeof services].map((service, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center border">
                        <img 
                          src={service.logoUrl} 
                          alt={service.name}
                          className="h-12 w-auto object-contain"
                        />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{service.name}</h3>
                      <Badge variant="outline" className="mb-3">{service.type}</Badge>
                      <p className="text-sm text-gray-600">{service.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-orange-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            مستعد لبدء رحلتك التعليمية؟
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            احجز استشارة مجانية مع خبرائنا لمساعدتك في اختيار الوجهة والتخصص المناسب لك
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100">
              احجز استشارة مجانية
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              تحدث مع مستشار
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default EducationalDestinationsPage;
