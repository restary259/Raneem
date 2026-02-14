
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, FileText, Globe, Handshake, Star, Award, HeartHandshake, BookOpenCheck, Briefcase, Linkedin, ShieldCheck, Lightbulb, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServiceProcess from "@/components/services/ServiceProcess";
import SEOHead from "@/components/common/SEOHead";
import PageHero from "@/components/common/PageHero";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";

const iconMap: Record<string, any> = { Users, UserCheck, FileText, Globe, Handshake, Award, ShieldCheck, HeartHandshake, Lightbulb, TrendingUp, Star, BookOpenCheck, Briefcase };

const WhoWeArePage = () => {
  const { t } = useTranslation(['about', 'common']);
  const { dir } = useDirection();

  const features = (t('whoWeAre.features', { returnObjects: true }) as any[]).map((f: any) => ({
    ...f, icon: iconMap[f.icon] || Users
  }));
  const teamMembers = t('whoWeAre.teamMembers', { returnObjects: true }) as any[];
  const ourValues = (t('whoWeAre.values', { returnObjects: true }) as any[]).map((v: any) => ({
    ...v, icon: iconMap[v.icon] || ShieldCheck
  }));
  const storyPoints = (t('whoWeAre.storyPoints', { returnObjects: true }) as any[]).map((s: any) => ({
    ...s, icon: iconMap[s.icon] || Lightbulb
  }));

  return <div className="flex flex-col min-h-screen bg-background text-foreground" dir={dir}>
            <SEOHead title={t('seo.whoWeAreTitle', { ns: 'common' })} description={t('seo.whoWeAreDesc', { ns: 'common' })} />
            <Header />
            <main className="flex-grow">
                <PageHero
                    variant="image"
                    imageUrl="https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80"
                    title={t('whoWeAre.heroTitle')}
                    subtitle={t('whoWeAre.heroSubtitle')}
                />

                <section className="py-16 md:py-24 bg-secondary/20">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-20 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-3"><BookOpenCheck className="text-accent" /> {t('whoWeAre.storyTitle')}</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                {t('whoWeAre.storySubtitle')}
                            </p>
                        </div>
                        
                        <div className="relative max-w-5xl mx-auto">
                            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-border -translate-x-1/2 hidden md:block" aria-hidden="true"></div>
                            
                            <div className="space-y-16 md:space-y-0">
                                {storyPoints.map((point: any, index: number) => {
                                    const Icon = point.icon;
                                    return <div key={index} className={`md:flex items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''} mb-8 md:mb-0`}>
                                        <div className="md:w-1/2">
                                            <Card className="bg-card shadow-xl border-l-4 md:border-l-0 md:border-r-4 border-accent transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 animate-fade-in">
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-3">
                                                        <Icon className="h-6 w-6 text-accent md:hidden" />
                                                        {point.title}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-muted-foreground">{point.description}</p>
                                                </CardContent>
                                            </Card>
                                        </div>
                                        <div className="hidden md:flex w-16 h-16 rounded-full bg-primary text-primary-foreground items-center justify-center mx-auto my-4 md:my-0 flex-shrink-0 relative shadow-lg">
                                            <Icon className="w-8 h-8" />
                                        </div>
                                        <div className="md:w-1/2"></div>
                                        <div className="h-12 w-0.5 bg-border mx-auto md:hidden"></div>
                                    </div>;
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-16 md:py-24 bg-secondary/20">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary">{t('whoWeAre.valuesTitle')}</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                {t('whoWeAre.valuesSubtitle')}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {ourValues.map((value: any, index: number) => {
                                const Icon = value.icon;
                                return <div key={value.title} className="text-center p-6 rounded-lg transition-all duration-300 animate-fade-in group hover:bg-card hover:shadow-lg" style={{ animationDelay: `${0.1 * (index + 1)}s` }}>
                                    <div className="inline-block bg-primary/10 text-primary p-4 rounded-full mb-4 ring-8 ring-primary/5 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground">
                                        <Icon className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary">{value.title}</h3>
                                    <p className="text-muted-foreground mt-2">{value.description}</p>
                                </div>;
                            })}
                        </div>
                    </div>
                </section>

                <section className="py-16 md:py-24 bg-background">
                    <div className="container mx-auto px-4">
                        <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold text-primary">{t('whoWeAre.featuresTitle')}</h2>
                            <p className="mt-4 text-lg text-muted-foreground">
                                {t('whoWeAre.featuresSubtitle')}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                            {features.map((feature: any, index: number) => {
                                const Icon = feature.icon;
                                return <Card key={feature.title} className="text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-2 bg-card animate-fade-in border-b-4 border-transparent hover:border-accent" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                    <CardHeader className="items-center">
                                        <div className="bg-primary/10 text-primary p-4 rounded-full w-fit mb-4">
                                            <Icon className="h-8 w-8" />
                                        </div>
                                        <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground">{feature.description}</p>
                                    </CardContent>
                                </Card>;
                            })}
                        </div>
                    </div>
                </section>

                <ServiceProcess title={t('whoWeAre.processTitle')} description={t('whoWeAre.processDesc')} className="bg-secondary/20" />
                
                <section className="bg-secondary text-secondary-foreground py-16 md:py-20">
                    <div className="container mx-auto px-4 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
                        <p className="text-2xl md:text-3xl font-semibold mb-4">
                            {t('whoWeAre.ctaLine1')}
                        </p>
                        <p className="text-xl font-serif text-secondary-foreground/80">
                            {t('whoWeAre.ctaLine2')}
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </div>;
};
export default WhoWeArePage;
