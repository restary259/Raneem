
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, Target, Award, Globe } from 'lucide-react';

const About = () => {
  const { t } = useTranslation(['about', 'common']);
  
  return (
    <section id="about" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-6">
              من نحن
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              درب هي منصة تعليمية رائدة تهدف إلى مساعدة الطلاب العرب في تحقيق أحلامهم الأكاديمية حول العالم
            </p>
          </div>

          {/* Mission & Vision */}
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">رسالتنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                نسعى لتقديم أفضل الخدمات التعليمية والاستشارية للطلاب العرب، 
                ومساعدتهم في اختيار المسار الأكاديمي المناسب والجامعة المثالية لتحقيق أهدافهم المهنية.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">رؤيتنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                أن نكون الوجهة الأولى للطلاب العرب الساعين للدراسة في الخارج، 
                وأن نساهم في بناء جيل متعلم ومؤهل قادر على المساهمة في تطوير مجتمعاتهم.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground">جامعة شريكة</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">10,000+</div>
              <div className="text-muted-foreground">طالب مقبول</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">50+</div>
              <div className="text-muted-foreground">دولة</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">95%</div>
              <div className="text-muted-foreground">نسبة النجاح</div>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="text-center p-6 bg-background rounded-lg">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="text-xl font-semibold mb-3">فريق خبير</h4>
              <p className="text-muted-foreground">
                فريقنا من المستشارين التعليميين المتخصصين يقدم الدعم والإرشاد في كل خطوة
              </p>
            </div>
            <div className="text-center p-6 bg-background rounded-lg">
              <Award className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="text-xl font-semibold mb-3">شراكات مميزة</h4>
              <p className="text-muted-foreground">
                شراكات قوية مع أفضل الجامعات والمؤسسات التعليمية حول العالم
              </p>
            </div>
            <div className="text-center p-6 bg-background rounded-lg">
              <Globe className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="text-xl font-semibold mb-3">خدمات شاملة</h4>
              <p className="text-muted-foreground">
                نقدم خدمات متكاملة من الاستشارة إلى القبول وما بعده
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link to="/contact">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                تواصل معنا اليوم
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
