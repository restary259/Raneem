
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFeedData, useRecommendationActions } from '@/hooks/useFeed';
import HeroSearch from './HeroSearch';
import RecommendationCarousel from './RecommendationCarousel';
import RecentlyViewed from './RecentlyViewed';
import DeadlinesCard from './DeadlinesCard';
import CommunitySpotlight from './CommunitySpotlight';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ExternalLink, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const HomeFeed: React.FC = () => {
  const { user } = useAuth();
  const { recommendations, offers, re‌centViews, deadlines, communityHighlights, isLoading } = useFeedData(user?.id || '');
  const { handleSave } = useRecommendationActions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">جار تحميل البيانات...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Hero Search */}
          <HeroSearch />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
              {/* Recommendations */}
              {recommendations.length > 0 && (
                <RecommendationCarousel
                  recommendations={recommendations}
                  onSave={handleSave}
                />
              )}

              {/* New Offers & Announcements */}
              {offers.length > 0 && (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      عروض وإعلانات جديدة
                    </h2>
                    <Button variant="ghost" size="sm">
                      عرض الكل
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {offers.slice(0, 5).map((offer) => (
                      <Card key={offer.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{offer.title}</h3>
                                {Date.now() - new Date(offer.created_at).getTime() < 48 * 60 * 60 * 1000 && (
                                  <Badge variant="destructive" className="text-xs">جديد</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {offer.message}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(offer.created_at), {
                                  addSuffix: true,
                                  locale: ar
                                })}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              عرض
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Recently Viewed */}
              <RecentlyViewed views={recentViews} />

              {/* Community Spotlight */}
              <CommunitySpotlight highlights={communityHighlights} />
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Deadlines */}
              <DeadlinesCard deadlines={deadlines} />

              {/* Footer Links */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">روابط سريعة</h3>
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      تصفح جميع الشركاء
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      تصفح جميع البرامج
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      المساعدة والأسئلة الشائعة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeFeed;
