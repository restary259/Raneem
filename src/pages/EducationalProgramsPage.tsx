
import React, { useState } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GraduationCap, Clock, Briefcase, BookOpen } from 'lucide-react';

const EducationalProgramsPage = () => {
  const educationalPrograms = {
    "العلوم الصحية والطبية": {
      description: "برامج متخصصة في المجال الطبي والصحي",
      color: "bg-blue-500",
      majors: [
        {
          name: "الطب (Medizin)",
          description: "تخصص يحتل أولوية واحدة بين التخصصات الطبية، يركز على تشخيص وعلاج الأمراض والاضطرابات الصحية المختلفة.",
          duration: "6 سنوات",
          career: "طبيب عام، طبيب متخصص، طبيب طوارئ",
          german: "Medizin"
        },
        {
          name: "طب الأسنان (Zahnmedizin)", 
          description: "تخصص يُعنى بصحة الفم والأسنان، يتعامل مع تشخيص وعلاج أمراض الأسنان واللثة.",
          duration: "5-6 سنوات",
          career: "طبيب أسنان، جراح فم، أخصائي تقويم",
          german: "Zahnmedizin"
        },
        {
          name: "الصيدلة (Pharmazie)",
          description: "تخصص يدرس الأدوية وتأثيراتها، يتضمن تحضير وتطوير الأدوية الجديدة.",
          duration: "5 سنوات", 
          career: "صيدلي، باحث أدوية، مدير صيدلية",
          german: "Pharmazie"
        }
      ]
    },
    "الهندسة والتكنولوجيا": {
      description: "برامج هندسية متقدمة تغطي التطبيقات النظرية والعملية",
      color: "bg-orange-500",
      majors: [
        {
          name: "العلاج الطبيعي (Physiotherapie)",
          description: "تخصص يُعنى بتحسين الحركة والوظائف الجسدية من خلال التمارين والعلاج اليدوي.",
          duration: "3-4 سنوات",
          career: "أخصائي علاج طبيعي، مدرب إعادة تأهيل",
          german: "Physiotherapie"
        },
        {
          name: "التمريض (Pflege wissenschaft)",
          description: "تخصص يُعنى بتقديم الرعاية الصحية والمساعدة في العلاج والوقاية من الأمراض.",
          duration: "3-4 سنوات", 
          career: "ممرض، مدير تمريض، أخصائي رعاية",
          german: "Pflegewissenschaft"
        },
        {
          name: "الطب البيطري (Tiermedizin)",
          description: "تخصص يُعنى بصحة الحيوانات، تشخيص وعلاج أمراض الحيوانات المختلفة.",
          duration: "5-6 سنوات",
          career: "طبيب بيطري، باحث في صحة الحيوان",
          german: "Tiermedizin"
        }
      ]
    },
    "العلوم الطبيعية": {
      description: "تخصصات علمية تركز على فهم الطبيعة والكون",
      color: "bg-green-500",
      majors: [
        {
          name: "علوم الصحة العامة (Gesundheitswissenschaften)",
          description: "تخصص يُعنى بدراسة العوامل المؤثرة على صحة المجتمع والوقاية من الأمراض.",
          duration: "3-4 سنوات",
          career: "أخصائي صحة عامة، باحث وبائي",
          german: "Gesundheitswissenschaften"
        },
        {
          name: "المعلوماتية الحيوية (Bioinformatik)",
          description: "تخصص يدمج بين علوم الحاسوب والبيولوجيا لتحليل البيانات الحيوية.",
          duration: "3-4 سنوات",
          career: "عالم معلوماتية حيوية، محلل بيانات طبية",
          german: "Bioinformatik"
        },
        {
          name: "الهندسة الطبية الحيوية (Biomedizintechnik)",
          description: "تخصص يجمع بين الهندسة والطب لتطوير التقنيات الطبية والأجهزة العلاجية.",
          duration: "4-5 سنوات",
          career: "مهندس طبي، مطور أجهزة طبية",
          german: "Biomedizintechnik"
        }
      ]
    }
  };

  const MajorPopup = ({ major }: { major: any }) => (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-right mb-4">
          {major.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6 text-right">
        <p className="text-gray-600 text-lg leading-relaxed">{major.description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <h4 className="font-semibold text-orange-800">مدة الدراسة</h4>
            </div>
            <p className="text-orange-600">{major.duration}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-800">الفرص المهنية</h4>
            </div>
            <p className="text-blue-600">{major.career}</p>
          </div>
        </div>

        {major.german && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-gray-600" />
              <h4 className="font-semibold text-gray-800">الاسم بالألمانية</h4>
            </div>
            <p className="text-gray-600 font-medium">{major.german}</p>
          </div>
        )}
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
              اكتشف تخصصك المثالي
            </Badge>
            <h1 className="text-5xl font-bold text-foreground mb-6">
              البرامج التعليمية
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              استكشف مجموعة واسعة من التخصصات الأكاديمية واختر المسار المهني الذي يناسب طموحاتك
            </p>
          </div>
        </div>
      </section>

      {/* Educational Programs */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Object.entries(educationalPrograms).map(([program, data]) => (
              <Card key={program} className="hover:shadow-xl transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className={`${data.color} p-4 rounded-lg mb-6 flex items-center justify-center`}>
                    <GraduationCap className="h-12 w-12 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4 text-center">{program}</h3>
                  <p className="text-gray-600 mb-6 text-center">{data.description}</p>
                  
                  <div className="space-y-3">
                    {data.majors.map((major, index) => (
                      <Dialog key={index}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start hover:bg-orange-50 hover:border-orange-300 transition-all duration-200"
                          >
                            <div className="flex items-center gap-3 w-full">
                              <div className={`w-3 h-3 rounded-full ${data.color}`}></div>
                              <span className="text-right flex-1">{major.name}</span>
                            </div>
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
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-orange-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            هل تحتاج مساعدة في اختيار التخصص؟
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
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
