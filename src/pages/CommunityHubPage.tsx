
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useForumCategories, useForumTopics, useCommunityEvents } from '@/hooks/useCommunity';
import { MessageSquare, Calendar, Users, Search, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const CommunityHubPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: categories = [] } = useForumCategories();
  const { data: topics = [] } = useForumTopics(undefined, searchQuery);
  const { data: events = [] } = useCommunityEvents();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>مرحباً بك في المجتمع</CardTitle>
            <CardDescription>
              يرجى تسجيل الدخول للمشاركة في المنتديات والفعاليات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate('/auth')}
            >
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">مجتمع الطلاب</h1>
          <p className="text-lg text-gray-600">
            انضم إلى مجتمعنا النابض بالحياة من الطلاب والخبراء
          </p>
        </div>

        <Tabs defaultValue="forum" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="forum" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              المنتدى
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              الفعاليات
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              المجموعات الدراسية
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forum" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="البحث في المواضيع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button onClick={() => navigate('/community/forum/new-topic')}>
                <Plus className="h-4 w-4 ml-2" />
                موضوع جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الأقسام</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        variant="ghost"
                        className="w-full justify-start text-right"
                        onClick={() => navigate(`/community/forum/category/${category.id}`)}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-3">
                <div className="space-y-4">
                  {topics.map((topic) => (
                    <Card key={topic.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <Link 
                              to={`/community/forum/topic/${topic.id}`}
                              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {topic.title}
                            </Link>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>بواسطة {topic.author?.full_name}</span>
                              <span>{format(new Date(topic.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                              <span>{topic.reply_count} رد</span>
                              <span>{topic.view_count} مشاهدة</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              {topic.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {topic.is_pinned && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              مثبت
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">الفعاليات القادمة</h2>
              <Button onClick={() => navigate('/community/events/create')}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة فعالية
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {event.host && `مقدم من: ${event.host}`}
                        </CardDescription>
                      </div>
                      {event.is_featured && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          مميز
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {event.description}
                    </p>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(event.start_time), 'dd MMM yyyy - HH:mm', { locale: ar })}
                      </div>
                      {event.max_attendees && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {event.attendees_count || 0} / {event.max_attendees} مشارك
                        </div>
                      )}
                    </div>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => navigate(`/community/events/${event.id}`)}
                    >
                      عرض التفاصيل
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">المجموعات الدراسية</h2>
              <Button onClick={() => navigate('/community/groups/create')}>
                <Plus className="h-4 w-4 ml-2" />
                إنشاء مجموعة
              </Button>
            </div>

            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                ستتوفر المجموعات الدراسية قريباً
              </h3>
              <p className="text-gray-500">
                نعمل على إضافة ميزة المجموعات الدراسية لتسهيل التعلم التشاركي
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CommunityHubPage;
