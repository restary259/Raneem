
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import CostCalculator from '@/components/calculator/CostCalculator';
import CurrencyConverter from '@/components/calculator/CurrencyConverter';
import GpaCalculator from '@/components/calculator/GpaCalculator';
import ResourceCard from '@/components/resources/ResourceCard';
import { Calculator, DollarSign, GraduationCap, FileText, Globe, Users } from 'lucide-react';

const ResourcesPage = () => {
  const { t } = useTranslation('resources');

  const tools = [
    {
      id: 'cost-calculator',
      title: 'حاسبة تكاليف الدراسة',
      description: 'احسب تكلفة دراستك في الخارج',
      icon: Calculator,
      component: <CostCalculator />
    },
    {
      id: 'currency-converter',
      title: 'محول العملات',
      description: 'تحويل العملات بأسعار محدثة',
      icon: DollarSign,
      component: <CurrencyConverter />
    },
    {
      id: 'gpa-calculator',
      title: 'حاسبة المعدل التراكمي',
      description: 'احسب معدلك التراكمي',
      icon: GraduationCap,
      component: <GpaCalculator />
    }
  ];

  const guides = [
    {
      title: 'دليل القبول الجامعي',
      description: 'كل ما تحتاج معرفته عن عملية القبول',
      icon: FileText,
      link: '#',
      category: 'القبول'
    },
    {
      title: 'دليل التأشيرات الدراسية',
      description: 'خطوات الحصول على التأشيرة الدراسية',
      icon: Globe,
      link: '#',
      category: 'التأشيرات'
    },
    {
      title: 'دليل السكن الطلابي',
      description: 'أفضل خيارات السكن للطلاب الدوليين',
      icon: Users,
      link: '#',
      category: 'السكن'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              الموارد والأدوات
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              أدوات وموارد مفيدة لمساعدتك في رحلة الدراسة في الخارج
            </p>
          </div>
        </div>
      </section>

      {/* Tools & Resources */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="tools" className="w-full max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="tools">الأدوات التفاعلية</TabsTrigger>
              <TabsTrigger value="guides">الأدلة والمراجع</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tools" className="space-y-8">
              <div className="grid gap-8">
                {tools.map((tool) => (
                  <Card key={tool.id} className="w-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        <tool.icon className="h-6 w-6 text-primary" />
                        {tool.title}
                      </CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {tool.component}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="guides" className="space-y-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {guides.map((guide, index) => (
                  <ResourceCard
                    key={index}
                    title={guide.title}
                    description={guide.description}
                    icon={guide.icon}
                    link={guide.link}
                    category={guide.category}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">الأسئلة الشائعة</h2>
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">كيف يمكنني استخدام حاسبة التكاليف؟</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    ببساطة اختر الدولة التي تريد الدراسة فيها، نوع الجامعة، تخصصك المطلوب، ونوع السكن. 
                    ستحصل على تقدير شامل لجميع التكاليف المتوقعة.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">هل أسعار الصرف محدثة؟</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    نعم، نحدث أسعار الصرف يومياً من مصادر موثوقة. الأسعار إرشادية وقد تختلف قليلاً عن الأسعار الفعلية في البنوك.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">كم دقيقة تقديرات التكاليف؟</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    تقديراتنا مبنية على بيانات حديثة من الجامعات والمؤسسات الرسمية. 
                    ننصح بالتواصل معنا للحصول على تقديرات مخصصة لحالتك.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ResourcesPage;
