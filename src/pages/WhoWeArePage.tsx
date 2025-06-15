import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, FileText, Globe, Handshake, Star, Award, HeartHandshake, BookOpenCheck } from "lucide-react";

const WhoWeArePage = () => {
    const features = [
        {
            icon: Users,
            title: "فريق من الخبراء",
            description: "لدينا خبرة عميقة بالأنظمة التعليمية في أوروبا والشرق الأوسط، خاصة في ألمانيا والأردن ورومانيا."
        },
        {
            icon: UserCheck,
            title: "إرشاد شخصي",
            description: "نقدم إرشادًا مصممًا خصيصًا ليتناسب مع احتياجات وظروف كل طالب على حدة."
        },
        {
            icon: FileText,
            title: "شفافية كاملة",
            description: "عملياتنا واضحة وشفافة بالكامل، دون أي رسوم خفية أو مفاجآت غير متوقعة."
        },
        {
            icon: Globe,
            title: "دعم ثقافي ولغوي",
            description: "نتفهم التحديات الثقافية واللغوية، ونقدم الدعم اللازم لتجاوزها بنجاح."
        },
        {
            icon: Handshake,
            title: "شبكة شركاء قوية",
            description: "نملك شبكة قوية من الشركاء الموثوقين من جامعات ومقدمي خدمات في وجهاتنا الدراسية."
        },
        {
            icon: Award,
            title: "دعم مستمر",
            description: "نرافقك في كل خطوة، من التحضير للسفر إلى الدعم المستمر أثناء دراستك لضمان نجاحك."
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
            <Header />
            <main className="flex-grow">
                <section className="bg-background py-20 md:py-28">
                    <div className="container mx-auto px-4 text-center animate-fade-in">
                        <h1 className="text-4xl md:text-6xl font-bold text-primary mb-4">شريكك نحو مستقبل مشرق</h1>
                        <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground">
                            في "درب للدراسة الدولية"، نحن أكثر من مجرد وكالة خدمات طلابية؛ نحن شريكك الموثوق في رحلتك الأكاديمية. إيماننا بأن التعليم هو المفتاح لإطلاق الطاقات الكامنة هو ما يدفعنا لتقديم دعم شامل وشخصي يرافقك من الخطوة الأولى وحتى تحقيق هدفك.
                        </p>
                    </div>
                </section>

                <section className="py-16 md:py-24">
                    <div className="container mx-auto px-4">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6 flex items-center gap-3"><Star className="text-accent" /> رسالتنا</h2>
                                <p className="text-muted-foreground leading-relaxed text-lg">
                                    ربط الطلاب العرب بأفضل الفرص التعليمية الدولية، مع التزامنا المطلق بالشفافية والنزاهة والخدمة التي تضع الطالب أولاً.
                                </p>
                            </div>
                            <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
                                <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6 flex items-center gap-3"><HeartHandshake className="text-accent" /> رؤيتنا</h2>
                                <p className="text-muted-foreground leading-relaxed text-lg">
                                    تمكين كل طالب من تحقيق طموحاته الأكاديمية والشخصية بثقة واطمئنان، ليصبحوا قادة المستقبل في مجتمعاتهم.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-16 md:py-24 bg-secondary/20">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-3"><BookOpenCheck className="text-accent" /> قصتنا</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                من رحم التجربة الشخصية، وُلدت "درب".
                            </p>
                        </div>
                        <div className="max-w-4xl mx-auto text-center text-muted-foreground leading-relaxed text-lg animate-fade-in" style={{ animationDelay: '0.2s' }}>
                            <p className="mb-4">
                                بدأت فكرة "درب" من خلال تجاربنا الخاصة كطلاب دوليين. لقد واجهنا التحديات، وشعرنا بالحيرة، وتمنينا وجود يد أمينة ترشدنا في كل خطوة. من هذا المنطلق، قررنا أن نكون نحن هذا الدليل للطلاب الذين يأتون بعدنا.
                            </p>
                            <p>
                                نحن لا نقدم مجرد استشارات، بل نشارككم خبراتنا الحقيقية ودروسنا التي تعلمناها. هدفنا هو جعل رحلتكم أسهل وأكثر سلاسة، لتتمكنوا من التركيز على ما هو أهم: تحقيق أحلامكم الأكاديمية.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="py-16 md:py-24 bg-background">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary">ما يميزنا عن غيرنا</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                نحن لا نقدم خدمة، بل نبني علاقة. إليك ما يجعلنا الخيار الأمثل لرحلتك التعليمية.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {features.map((feature, index) => (
                                <Card key={feature.title} className="text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-2 bg-card animate-fade-in border-transparent hover:border-accent" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                    <CardHeader className="items-center">
                                        <div className="bg-primary/10 text-primary p-4 rounded-full w-fit mb-4">
                                            <feature.icon className="h-8 w-8" />
                                        </div>
                                        <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>
                
                <section className="bg-primary text-primary-foreground py-16 md:py-20">
                    <div className="container mx-auto px-4 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
                        <p className="text-2xl md:text-3xl font-semibold mb-4">
                            ندعوك للانطلاق في رحلتك معنا بثقة. نجاحك هو نجاحنا.
                        </p>
                        <p className="text-xl font-serif text-primary-foreground/80">
                            شريكك الأمين لتحقيق حلم التعليم العالي.
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default WhoWeArePage;
