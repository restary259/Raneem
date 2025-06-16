import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Pie, Bar } from "react-chartjs-2"; // Assume chart.js integration
import { Mail, User, FileText, CreditCard, PieChart, Settings as Cog } from "lucide-react";

// ...Types for Profile, Application, Payment, Document (reuse from previous example)...

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  // ...All existing states for students/applications/payments/documents...
  // Add states for analytics, email modal, settings, etc.

  // Admin check
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return navigate('/student-auth');
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();
      if (!data?.is_admin) return navigate('/');
      setIsAdmin(true);
    };
    checkAdmin();
  }, [navigate]);

  // ...Fetching students, applications, payments, documents, analytics...

  if (!isAdmin) return null;

  // ---- DASHBOARD QUICK STATS ----
  const totalStudents = students.length;
  const newStudentsThisMonth = students.filter(s => s.created_at?.startsWith(new Date().toISOString().slice(0,7))).length;
  const totalApplications = applications.length;
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // Example analytics data for charts:
  const studentsByCountry = students.reduce((acc, s) => {
    acc[s.country] = (acc[s.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const chartData = {
    labels: Object.keys(studentsByCountry),
    datasets: [{ data: Object.values(studentsByCountry), backgroundColor: ["#3b82f6","#f59e42","#22c55e","#ef4444","#6366f1","#eab308"] }]
  };

  return (
    <div className="p-4 md:p-8" dir="rtl">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex flex-wrap gap-2">
          <TabsTrigger value="overview"><PieChart className="ml-1" />لوحة البيانات</TabsTrigger>
          <TabsTrigger value="students"><User className="ml-1" />الطلاب</TabsTrigger>
          <TabsTrigger value="applications"><FileText className="ml-1" />الطلبات</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="ml-1" />الدفعات</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="ml-1" />المستندات</TabsTrigger>
          <TabsTrigger value="email"><Mail className="ml-1" />إرسال بريد</TabsTrigger>
          <TabsTrigger value="settings"><Cog className="ml-1" />الإعدادات</TabsTrigger>
        </TabsList>

        {/* ----------------- Overview/Analytics ----------------- */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader>إجمالي الطلاب</CardHeader>
              <CardContent className="text-3xl font-bold">{totalStudents}</CardContent>
            </Card>
            <Card>
              <CardHeader>طلاب جدد هذا الشهر</CardHeader>
              <CardContent className="text-3xl font-bold">{newStudentsThisMonth}</CardContent>
            </Card>
            <Card>
              <CardHeader>إجمالي الطلبات</CardHeader>
              <CardContent className="text-3xl font-bold">{totalApplications}</CardContent>
            </Card>
            <Card>
              <CardHeader>إجمالي الدفعات</CardHeader>
              <CardContent className="text-3xl font-bold">{totalPayments} ريال</CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>التوزيع الجغرافي للطلاب</CardHeader>
              <CardContent>
                <Pie data={chartData} />
              </CardContent>
            </Card>
            {/* Add more charts as needed */}
          </div>
        </TabsContent>

        {/* ----------------- Students Tab ----------------- */}
        <TabsContent value="students">
          {/* ...Student management table as before, with advanced search, impersonation button, etc... */}
        </TabsContent>

        {/* ----------------- Applications Tab ----------------- */}
        <TabsContent value="applications">
          {/* ...Applications management table, timeline, bulk actions... */}
        </TabsContent>

        {/* ----------------- Payments Tab ----------------- */}
        <TabsContent value="payments">
          {/* ...Payments management, filtering, stats... */}
        </TabsContent>

        {/* ----------------- Documents Tab ----------------- */}
        <TabsContent value="documents">
          {/* ...Documents search, preview, download... */}
        </TabsContent>

        {/* ----------------- Email/Group Messaging Tab ----------------- */}
        <TabsContent value="email">
          {/* ...Send to group, single student, batch, save templates... */}
        </TabsContent>

        {/* ----------------- Settings Tab ----------------- */}
        <TabsContent value="settings">
          {/* ...Admins management, branding, export data, dark mode toggle... */}
        </TabsContent>
      </Tabs>

      {/* --- Modals for editing, deleting, viewing, sending email, etc. as needed --- */}
    </div>
  );
};

export default AdminDashboardPage;
