
import React, { useState } from 'react';
import { RefreshCw, Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useFeed } from '@/hooks/useFeed';
import PostCard from './PostCard';

const UnifiedFeed = () => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const filters = activeFilter === 'all' ? undefined : { post_type: activeFilter };
  const { posts, isLoading } = useFeed(filters);

  const handleSave = (postId: string) => {
    console.log('Save post:', postId);
  };

  const handleShare = (post: any) => {
    console.log('Share post:', post);
  };

  const handleComment = (post: any) => {
    console.log('Comment on post:', post);
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل المحتوى...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">الصفحة الرئيسية</h1>
          <p className="text-gray-600">آخر الأخبار والفرص الدراسية</p>
        </div>
        <Button className="mt-4 md:mt-0 bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 ml-2" />
          إنشاء منشور
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <Input
          placeholder="البحث في المنشورات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('all')}
          >
            الكل
          </Button>
          <Button
            variant={activeFilter === 'scholarship' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('scholarship')}
          >
            منح دراسية
          </Button>
          <Button
            variant={activeFilter === 'program' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('program')}
          >
            برامج
          </Button>
          <Button
            variant={activeFilter === 'announcement' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('announcement')}
          >
            إعلانات
          </Button>
          <Button
            variant={activeFilter === 'event' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('event')}
          >
            فعاليات
          </Button>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-6">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              لا توجد منشورات
            </h3>
            <p className="text-gray-600">
              لا توجد منشورات تطابق المرشحات المحددة
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onSave={handleSave}
              onShare={handleShare}
              onComment={handleComment}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default UnifiedFeed;
