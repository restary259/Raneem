
import React, { useState, useMemo } from 'react';
import HeroVideo from '@/components/broadcast/HeroVideo';
import VideoCategories from '@/components/broadcast/VideoCategories';
import VideoGallery from '@/components/broadcast/VideoGallery';
import SubmitVideo from '@/components/broadcast/SubmitVideo';
import { broadcastData, BroadcastCategory } from '@/components/broadcast/data';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from "@/hooks/use-mobile";

const BroadcastPage = () => {
  const { t } = useTranslation('broadcast');
  const [selectedCategory, setSelectedCategory] = useState<BroadcastCategory | 'all'>('all');
  const isMobile = useIsMobile();

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
        <div dir="rtl" className="flex items-center justify-center h-screen">
            <p>{t('broadcastPage.loading')}</p>
        </div>
    );
  }

  return (
    <div dir="rtl" className="bg-background dark:bg-gray-950">
      {/* Header is handled by MobileLayout */}
      <main>
        <HeroVideo post={featuredVideo} />
        
        <section className="py-8 md:py-16">
          <div className="container">
              <div className="text-right mb-8">
                  <h2 className="text-3xl font-bold">{t('broadcastPage.categoriesTitle')}</h2>
              </div>
              <VideoCategories selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
          </div>
        </section>

        <section className="pb-12 md:pb-24">
            <div className="container">
                <div className="text-right mb-8">
                    <h2 className="text-3xl font-bold">{t('broadcastPage.galleryTitle')}</h2>
                </div>
                <VideoGallery posts={galleryVideos} />
            </div>
        </section>
        
        <SubmitVideo />

      </main>
      {!isMobile && (
        <footer className="py-8 text-center text-muted-foreground bg-muted/50 dark:bg-muted/20">
          <div className="container">
            <p>{t('broadcastPage.footer')}</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default BroadcastPage;
