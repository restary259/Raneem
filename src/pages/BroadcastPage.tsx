
import React, { useState, useMemo } from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import HeroVideo from '@/components/broadcast/HeroVideo';
import DarbPageHero from '@/components/common/DarbPageHero';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';
import VideoCategories from '@/components/broadcast/VideoCategories';
import VideoGallery from '@/components/broadcast/VideoGallery';
import SubmitVideo from '@/components/broadcast/SubmitVideo';
import { broadcastData, BroadcastCategory } from '@/components/broadcast/data';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const BroadcastPage = () => {
  const { t } = useTranslation(['broadcast', 'common']);
  const { dir } = useDirection();
  const [selectedCategory, setSelectedCategory] = useState<BroadcastCategory | 'all'>('all');

  const featuredVideo = useMemo(() => broadcastData.find(p => p.featured), []);
  
  const galleryVideos = useMemo(() => {
    const nonFeatured = broadcastData.filter(p => !p.featured)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (selectedCategory === 'all') {
      return nonFeatured;
    }
    return nonFeatured.filter(p => p.category === selectedCategory);
  }, [selectedCategory]);

  if (!featuredVideo) {
    return (
        <div dir={dir} className="flex items-center justify-center h-screen">
            <p>{t('loading', { ns: 'broadcast' })}</p>
        </div>
    );
  }

  return (
    <div dir={dir} className="bg-background">
      <SEOHead title={t('seo.broadcastTitle', { ns: 'common' })} description={t('seo.broadcastDesc', { ns: 'common' })} />
      <Header />
      <main>
        <DarbPageHero
          compact
          eyebrow={t('broadcastHero.eyebrow', { ns: 'broadcast', defaultValue: 'DARB BROADCAST' })}
          imageUrl={DARB_PUBLIC_HERO_IMAGES.city}
          imageAlt={t('broadcastHero.imageAlt', { ns: 'broadcast', defaultValue: 'Bright German study and media environment' })}
          title={t('broadcastHero.title', { ns: 'broadcast', defaultValue: 'Germany through the DARB journey' })}
          subtitle={t('broadcastHero.subtitle', { ns: 'broadcast', defaultValue: 'Educational videos, updates and stories for students preparing for Germany.' })}
        />
        <HeroVideo post={featuredVideo} />
        
        <section className="py-8 md:py-16">
          <div className="container">
              <div className="mb-8">
                  <h2 className="text-3xl font-bold">{t('categoriesTitle', { ns: 'broadcast' })}</h2>
              </div>
              <VideoCategories selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
          </div>
        </section>

        <section className="pb-12 md:pb-24">
            <div className="container">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold">{t('galleryTitle', { ns: 'broadcast' })}</h2>
                </div>
                <VideoGallery posts={galleryVideos} />
            </div>
        </section>
        
        <SubmitVideo />


      </main>
      <Footer />
    </div>
  );
};

export default BroadcastPage;
