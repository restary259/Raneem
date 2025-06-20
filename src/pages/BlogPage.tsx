
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';

const BlogPage = () => {
  const blogPosts = [
    {
      id: 1,
      title: "دليل شامل للحصول على التأشيرة الدراسية لألمانيا",
      excerpt: "تعرف على الخطوات المفصلة والوثائق المطلوبة للحصول على التأشيرة الدراسية الألمانية بنجاح.",
      image: "/placeholder.svg?height=200&width=400",
      category: "التأشيرات",
      date: "2024-01-15",
      readTime: "8 دقائق",
      slug: "germany-student-visa-guide"
    },
    {
      id: 2,
      title: "كيفية التأقلم مع الثقافة الأوروبية: نصائح للطلاب العرب",
      excerpt: "اكتشف الاستراتيجيات الفعالة للتكيف مع البيئة الثقافية الجديدة وبناء علاقات إيجابية.",
      image: "/placeholder.svg?height=200&width=400",
      category: "الحياة الطلابية",
      date: "2024-01-10",
      readTime: "6 دقائق",
      slug: "cultural-adaptation-guide"
    },
    {
      id: 3,
      title: "أسرار تعلم اللغة الألمانية بسرعة وفعالية",
      excerpt: "طرق مثبتة علمياً لتسريع عملية تعلم اللغة الألمانية والوصول لمستوى B2 في 6 أشهر.",
      image: "/placeholder.svg?height=200&width=400",
      category: "اللغات",
      date: "2024-01-05",
      readTime: "10 دقائق",
      slug: "german-language-hacks"
    },
    {
      id: 4,
      title: "إدارة الميزانية للطلاب: كيف تعيش بـ800 يورو شهرياً في ألمانيا",
      excerpt: "دليل مفصل لإدارة نفقاتك الشهرية والحصول على أفضل العروض للطلاب في ألمانيا.",
      image: "/placeholder.svg?height=200&width=400",
      category: "المالية",
      date: "2023-12-28",
      readTime: "7 دقائق",
      slug: "student-budget-guide"
    },
    {
      id: 5,
      title: "بناء الشبكة المهنية أثناء الدراسة: دليل الطالب الذكي",
      excerpt: "كيفية استغلال فترة الدراسة لبناء علاقات مهنية قوية تفتح لك آفاق العمل المستقبلية.",
      image: "/placeholder.svg?height=200&width=400",
      category: "التطوير المهني",
      date: "2023-12-20",
      readTime: "9 دقائق",
      slug: "networking-guide"
    }
  ];

  const categories = ["الكل", "التأشيرات", "الحياة الطلابية", "اللغات", "المالية", "التطوير المهني"];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              مدونة درب
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              نصائح ودلائل شاملة لرحلتك الدراسية في الخارج
            </p>
          </div>
        </div>
      </section>

      {/* Categories Filter */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <Badge 
                key={category} 
                variant="outline" 
                className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-white transition-colors"
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Card key={post.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="aspect-video overflow-hidden rounded-t-lg">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {post.category}
                    </Badge>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.date).toLocaleDateString('ar-SA')}
                    </div>
                  </div>
                  
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readTime}
                    </div>
                    
                    <Button variant="ghost" size="sm" className="p-0 h-auto">
                      اقرأ المزيد
                      <ArrowLeft className="h-4 w-4 mr-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BlogPage;
