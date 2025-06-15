import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, FileText, Globe, Handshake, Star, Award, HeartHandshake, BookOpenCheck, Briefcase, Linkedin, ShieldCheck, Lightbulb, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

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

    const teamMembers = [
        {
            name: "أحمد العلي",
            title: "المؤسس والرئيس التنفيذي",
            image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&q=80",
            bio: "خبير في أنظمة التعليم الأوروبية، وشغوف بمساعدة الطلاب على تحقيق أحلامهم.",
            linkedin: "#"
        },
        {
            name: "فاطمة الزهراء",
            title: "مديرة شؤون الطلاب",
            image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&q=80",
            bio: "متخصصة في الإرشاد الأكاديمي وتقديم الدعم الشخصي للطلاب طوال رحلتهم.",
            linkedin: "#"
        },
        {
            name: "علي حسن",
            title: "مستشار التعليم في ألمانيا",
            image: "https://images.unsplash.com/photo-1590086782792-42dd2350150d?w=500&q=80",
            bio: "مقيم في ألمانيا ويمتلك شبكة واسعة من العلاقات مع الجامعات والمؤسسات التعليمية.",
            linkedin: "#"
        }
    ];

    const ourValues = [
        {
            icon: ShieldCheck,
            title: "النزاهة والشفافية",
            description: "نلتزم بأعلى معايير الصدق والوضوح في جميع تعاملاتنا."
        },
        {
            icon: HeartHandshake,
            title: "الطالب أولاً",
            description: "مصلحة الطالب هي بوصلتنا، ونجاحه هو أولويتنا القصوى."
        },
        {
            icon: Lightbulb,
            title: "التميز والابتكار",
            description: "نسعى دائمًا لتقديم حلول مبتكرة وخدمات تفوق التوقعات."
        },
        {
            icon: TrendingUp,
            title: "النمو المستمر",
            description: "نؤمن بالتعلم والتطور المستمر لنا ولطلابنا على حد سواء."
        }
    ];

    const storyPoints = [
        {
            title: "البداية",
            description: "رؤية ولدت من رحم الحاجة، لتوفير المعلومات الدقيقة والدعم الصادق للطلاب العرب الطموحين.",
        },
        {
            title: "النمو والتطور",
            description: "توسيع شبكة شركائنا من الجامعات المرموقة، وبناء فريق من الخبراء المتفانين في خدمة الطلاب.",
        },
        {
            title: "المستقبل",
            description: "نطمح لنكون الوجهة الأولى للطلاب العرب، مع الالتزام بقيمنا الأساسية: الشفافية، النزاهة، والخدمة المتميزة.",
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
            <Header />
            <main className="flex-grow">
                <section className="relative bg-background py-24 md:py-36 text-center text-white">
                    <div className="absolute inset-0 bg-black/60 z-0">
                        <img 
                            src="https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&q=80" 
                            alt="خلفية مجردة بألوان متدرجة ترمز إلى الإبداع والحداثة" 
                            className="w-full h-full object-cover" 
                        />
                    </div>
                    <div className="container mx-auto px-4 relative z-10 animate-fade-in">
                        <h1 className="text-4xl md:text-6xl font-bold drop-shadow-lg mb-4">شريكك نحو مستقبل مشرق</h1>
                        <p className="max-w-3xl mx-auto text-lg md:text-xl text-white/90 drop-shadow-md">
                            في "درب للدراسة الدولية"، نحن أكثر من مجرد وكالة خدمات طلابية؛ نحن شريكك الموثوق في رحلتك الأكاديمية. إيماننا بأن التعليم هو المفتاح لإطلاق الطاقات الكامنة هو ما يدفعنا لتقديم دعم شامل وشخصي يرافقك من الخطوة الأولى وحتى تحقيق هدفك.
                        </p>
                    </div>
                </section>

                <section className="py-16 md:py-24 bg-secondary/20">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-20 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-3"><BookOpenCheck className="text-accent" /> قصتنا: مسار من الإلهام</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                بدأت "درب" من تجاربنا الشخصية كطلاب دوليين. واجهنا التحديات، وتمنينا وجود يد أمينة ترشدنا. من هذا المنطلق، قررنا أن نكون نحن هذا الدليل للطلاب الذين يأتون بعدنا.
                            </p>
                        </div>
                        
                        <div className="relative max-w-5xl mx-auto">
                            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-border -translate-x-1/2 hidden md:block" aria-hidden="true"></div>
                            
                            <div className="space-y-16 md:space-y-0">
                                {storyPoints.map((point, index) => (
                                    <div key={index} className={`md:flex items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''} mb-8 md:mb-0`}>
                                        <div className="md:w-1/2">
                                            <Card className="bg-card shadow-xl border-l-4 md:border-l-0 md:border-r-4 border-accent transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 animate-fade-in">
                                                <CardHeader>
                                                    <CardTitle>{point.title}</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-muted-foreground">{point.description}</p>
                                                </CardContent>
                                            </Card>
                                        </div>
                                        <div className="hidden md:flex w-16 h-16 rounded-full bg-primary items-center justify-center mx-auto my-4 md:my-0 flex-shrink-0 relative shadow-lg">
                                            <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
                                        </div>
                                        <div className="md:w-1/2"></div>
                                        <div className="h-12 w-0.5 bg-border mx-auto md:hidden"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
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

                <section className="py-16 md:py-24 bg-background">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary">تعرّف على فريقنا</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                نحن مجموعة من الخبراء والمستشارين الذين مروا بنفس تجربتك، ومستعدون لمساعدتك.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {teamMembers.map((member, index) => (
                                <Card key={member.name} className="text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-2 bg-card animate-fade-in overflow-hidden" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                    <div className="h-48 overflow-hidden">
                                        <img src={member.image} alt={member.name} className="w-full h-full object-cover object-top" />
                                    </div>
                                    <CardContent className="p-6">
                                        <h3 className="text-xl font-bold text-primary">{member.name}</h3>
                                        <p className="text-accent font-semibold flex items-center justify-center gap-2 mt-1 mb-3"><Briefcase size={16} /> {member.title}</p>
                                        <p className="text-muted-foreground text-sm mb-4">{member.bio}</p>
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={member.linkedin} target="_blank" rel="noopener noreferrer">
                                                <Linkedin className="text-muted-foreground hover:text-primary" />
                                            </a>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>
                
                <section className="py-16 md:py-24 bg-secondary/20">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary">قيمنا الأساسية</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                المبادئ التي توجه كل قرار نتخذه وكل خدمة نقدمها.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {ourValues.map((value, index) => (
                                <div key={value.title} className="text-center p-6 rounded-lg transition-all duration-300 animate-fade-in group hover:bg-card hover:shadow-lg" style={{ animationDelay: `${0.1 * (index + 1)}s` }}>
                                    <div className="inline-block bg-primary/10 text-primary p-4 rounded-full mb-4 ring-8 ring-primary/5 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground">
                                        <value.icon className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary">{value.title}</h3>
                                    <p className="text-muted-foreground mt-2">{value.description}</p>
                                </div>
                            ))}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                            {features.map((feature, index) => (
                                <Card key={feature.title} className="text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-2 bg-card animate-fade-in border-b-4 border-transparent hover:border-accent" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
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
