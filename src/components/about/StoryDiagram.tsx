import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, Star, HeartHandshake, Globe, ArrowDown, ExternalLink } from 'lucide-react';
const StoryDiagram = () => {
  const storyPoints = [{
    icon: Lightbulb,
    title: "البداية: شرارة الفكرة",
    description: "رؤية ولدت من رحم الحاجة، لتوفير المعلومات الدقيقة والدعم الصادق للطلاب العرب الطموحين.",
    year: "2014",
    color: "bg-yellow-500",
    link: "/about/founding-story"
  }, {
    icon: TrendingUp,
    title: "النمو: بناء الجسور",
    description: "توسيع شبكة شركائنا من الجامعات المرموقة، وبناء فريق من الخبراء المتفانين في خدمة الطلاب.",
    year: "2016-2018",
    color: "bg-blue-500",
    link: "/about/growth-phase"
  }, {
    icon: Star,
    title: "رسالتنا: بوصلة عملنا",
    description: "ربط الطلاب العرب بأفضل الفرص التعليمية الدولية، مع التزامنا المطلق بالشفافية والنزاهة.",
    year: "2019-2021",
    color: "bg-green-500",
    link: "/about/mission"
  }, {
    icon: HeartHandshake,
    title: "رؤيتنا: تمكين المستقبل",
    description: "تمكين كل طالب من تحقيق طموحاته الأكاديمية والشخصية بثقة واطمئنان، ليصبحوا قادة المستقبل.",
    year: "2022-2023",
    color: "bg-purple-500",
    link: "/about/vision"
  }, {
    icon: Globe,
    title: "المستقبل: آفاق عالمية",
    description: "نطمح لنكون الوجهة الأولى للطلاب العرب، مع الالتزام بقيمنا الأساسية والابتكار المستمر.",
    year: "2024+",
    color: "bg-orange-500",
    link: "/about/future-plans"
  }];
  return <section className="py-16 md:py-24 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-20 animate-fade-in">
          <Badge variant="outline" className="mb-4">
            قصتنا التفاعلية
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-3">
            
            مسار من الإلهام - رحلة درب
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            بدأت "درب" من تجاربنا الشخصية كطلاب دوليين. اكتشف كيف تطورت رؤيتنا عبر السنين
          </p>
        </div>
        
        <div className="relative max-w-5xl mx-auto">
          {/* Vertical Timeline Line */}
          <div className="absolute left-1/2 top-0 h-full w-1 bg-gradient-to-b from-primary via-accent to-primary -translate-x-1/2 hidden md:block" aria-hidden="true"></div>
          
          <div className="space-y-16 md:space-y-12">
            {storyPoints.map((point, index) => <div key={index} className={`md:flex items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''} mb-8 md:mb-0 group`}>
                <div className="md:w-1/2 px-4">
                  <Card className="bg-card shadow-xl border-l-4 md:border-l-0 md:border-r-4 border-accent transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 animate-fade-in group-hover:scale-105">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`text-white ${point.color}`}>
                          {point.year}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => window.open(point.link, '_blank')} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardTitle className="flex items-center gap-3 text-lg">
                        <point.icon className="h-6 w-6 text-accent md:hidden" />
                        {point.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">{point.description}</p>
                      
                    </CardContent>
                  </Card>
                </div>
                
                {/* Timeline Node */}
                <div className="hidden md:flex w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground items-center justify-center mx-auto my-4 md:my-0 flex-shrink-0 relative shadow-2xl group-hover:scale-110 transition-transform duration-300">
                  <point.icon className="w-8 h-8" />
                  <div className="absolute -inset-2 bg-primary/20 rounded-full animate-pulse"></div>
                </div>
                
                <div className="md:w-1/2"></div>
                
                {/* Mobile Arrow */}
                {index < storyPoints.length - 1 && <div className="flex justify-center md:hidden">
                    <ArrowDown className="h-6 w-6 text-accent animate-bounce" />
                  </div>}
              </div>)}
          </div>
        </div>
        
        {/* Interactive CTA */}
        <div className="text-center mt-16">
          <Card className="max-w-md mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            
          </Card>
        </div>
      </div>
    </section>;
};
export default StoryDiagram;