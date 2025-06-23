
import React, { useState } from 'react';
import { Plus, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApplications } from '@/hooks/useApplications';
import ApplicationCard from '@/components/applications/ApplicationCard';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const ApplicationsPage = () => {
  const { user } = useAuth();
  const { applications, isLoading } = useApplications();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (!user) {
    return <Navigate to="/student-auth" replace />;
  }

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.notes?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         app.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleEdit = (application: any) => {
    console.log('Edit application:', application);
  };

  const handleViewDetails = (application: any) => {
    console.log('View details:', application);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8" dir="rtl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل الطلبات...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">طلباتي</h1>
            <p className="text-gray-600">إدارة جميع طلبات التقديم الخاصة بك</p>
          </div>
          <Button className="mt-4 md:mt-0 bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 ml-2" />
            طلب جديد
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{applications.length}</p>
                </div>
                <Badge variant="secondary">{applications.length}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">قيد المراجعة</p>
                  <p className="text-2xl font-bold">{statusCounts.under_review || 0}</p>
                </div>
                <Badge className="bg-yellow-500">{statusCounts.under_review || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">مقبولة</p>
                  <p className="text-2xl font-bold">{statusCounts.accepted || 0}</p>
                </div>
                <Badge className="bg-green-500">{statusCounts.accepted || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">مسودة</p>
                  <p className="text-2xl font-bold">{statusCounts.draft || 0}</p>
                </div>
                <Badge variant="outline">{statusCounts.draft || 0}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="البحث في الطلبات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              الكل
            </Button>
            <Button
              variant={statusFilter === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('draft')}
            >
              مسودة
            </Button>
            <Button
              variant={statusFilter === 'submitted' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('submitted')}
            >
              مُرسل
            </Button>
            <Button
              variant={statusFilter === 'under_review' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('under_review')}
            >
              قيد المراجعة
            </Button>
          </div>
        </div>

        {/* Applications List */}
        {filteredApplications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    لا توجد طلبات بعد
                  </h3>
                  <p className="text-gray-600 mb-6">
                    ابدأ رحلتك الدراسية بإنشاء طلب التقديم الأول
                  </p>
                  <Button className="bg-orange-500 hover:bg-orange-600">
                    <Plus className="h-4 w-4 ml-2" />
                    إنشاء طلب جديد
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onEdit={handleEdit}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationsPage;
