
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import ResourceCard from '@/components/resources/ResourceCard';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const resources = [
  {
    title: 'قائمة المستلزمات: ماذا تحزم؟',
    description: 'قائمة تحقق شاملة لجميع الأغراض الأساسية التي ستحتاجها لرحلتك وبدايتك الجديدة في ألمانيا.',
    fileUrl: '/downloads/what-to-pack.pdf',
    fileSize: '1.2MB'
  },
  {
    title: 'دليل الوثائق المطلوبة',
    description: 'لا تنس أي مستند مهم! استخدم هذا الدليل للتأكد من أن جميع أوراقك جاهزة ومنظمة.',
    fileUrl: '/downloads/required-documents.pdf',
    fileSize: '850KB'
  },
  {
    title: 'نصائح للأيام الأولى في الخارج',
    description: 'دليل إرشادي لمساعدتك على التأقلم بسرعة خلال أيامك وأسابيعك الأولى في ألمانيا.',
    fileUrl: '/downloads/first-days-tips.pdf',
    fileSize: '2.1MB'
  },
  {
    title: 'دليل المرافق الطبية في هايدلبرغ',
    description: 'قائمة شاملة بالمستشفيات والأطباء والصيدليات في مدينة هايدلبرغ لراحتك وأمانك.',
    fileUrl: '/downloads/heidelberg-medical.pdf',
    fileSize: '3.5MB'
  }
];

const ResourcesPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <section className="bg-secondary/30 py-20">
            <div className="container mx-auto px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">
                    الموارد والأدلة
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                    لقد قمنا بتجميع أدلة وموارد مفيدة لجعل رحلتك الدراسية إلى ألمانيا أكثر سلاسة. قم بتحميل ما تحتاجه للتحضير بشكل كامل.
                </p>
            </div>
        </section>
        
        <section className="container mx-auto px-4 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {resources.map((resource, index) => (
                <ResourceCard 
                  key={index}
                  title={resource.title}
                  description={resource.description}
                  fileUrl={resource.fileUrl}
                  fileSize={resource.fileSize}
                />
              ))}
            </div>
        </section>
        
        <section className="container mx-auto px-4 pb-16">
            <div className="text-center p-8 bg-secondary/50 rounded-lg border border-primary/20">
              <h3 className="text-2xl font-bold text-primary mb-2">هل تحتاج إلى دليل مخصص؟</h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                إذا لم تجد ما تبحث عنه أو كنت بحاجة إلى معلومات محددة لمدينتك أو جامعتك، فلا تتردد في التواصل معنا.
              </p>
              <Button asChild size="lg">
                <Link to="/contact">
                    تواصل معنا
                </Link>
              </Button>
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ResourcesPage;
