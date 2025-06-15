
import React, { useState, useMemo } from 'react';
import Header from '@/components/landing/Header';
import HeroVideo from '@/components/broadcast/HeroVideo';
import VideoCategories from '@/components/broadcast/VideoCategories';
import VideoGallery from '@/components/broadcast/VideoGallery';
import SubmitVideo from '@/components/broadcast/SubmitVideo';
import { broadcastData, BroadcastCategory } from '@/components/broadcast/data';

const BroadcastPage = () => {
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
    // A simple fallback if no featured video is found in data
    return (
        <div dir="rtl" className="flex items-center justify-center h-screen">
            <p>جاري تحميل محتوى البث...</p>
        </div>
    );
  }

  return (
    <div dir="rtl" className="bg-background dark:bg-gray-950">
      <Header />
      <main>
        <HeroVideo post={featuredVideo} />
        
        <section className="py-8 md:py-16">
          <div className="container">
              <div className="text-right mb-8">
                  <h2 className="text-3xl font-bold">📚 فئات الفيديو</h2>
              </div>
              <VideoCategories selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
          </div>
        </section>

        <section className="pb-12 md:pb-24">
            <div className="container">
                <div className="text-right mb-8">
                    <h2 className="text-3xl font-bold">🎬 معرض مقاطع الفيديو</h2>
                </div>
                <VideoGallery posts={galleryVideos} />
            </div>
        </section>
        
        <SubmitVideo />

      </main>
      <footer className="py-8 text-center text-muted-foreground bg-muted/50 dark:bg-muted/20">
        <div className="container">
          <p>“كل ما تريد معرفته عن الحياة والدراسة في الخارج… بالفيديو وعلى طول الخط مع دارب ستادي إنترناشونال.”</p>
        </div>
      </footer>
    </div>
  );
};

export default BroadcastPage;
