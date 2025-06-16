import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pie, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";
import { useNavigate } from "react-router-dom";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

type Profile = {
  id: string;
  full_name: string;
  email: string;
  country: string;
  created_at?: string;
};

type Application = {
  id: string;
  submitted_at: string;
};

type Payment = {
  amount_paid: number;
};

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState<Profile[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Auth check (optional, add your admin check here)
    // Fetch all dashboard data
    fetchStudents();
    fetchApplications();
    fetchPayments();
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setStudents(data);
  };
  const fetchApplications = async () => {
    const { data } = await supabase.from("applications").select("*");
    if (data) setApplications(data);
  };
  const fetchPayments = async () => {
    const { data } = await supabase.from("payments").select("amount_paid");
    if (data) setPayments(data);
  };

  // --- Analytics logic ---
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const totalStudents = students.length;
  const newStudentsThisMonth = students.filter(s => s.created_at?.startsWith(currentMonth)).length;
  const totalApplications = applications.length;
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // Pie: Students by country
  const studentsByCountry = students.reduce((acc: Record<string, number>, s) => {
    acc[s.country] = (acc[s.country] || 0) + 1;
    return acc;
  }, {});
  const pieData = {
    labels: Object.keys(studentsByCountry),
    datasets: [{
      data: Object.values(studentsByCountry),
      backgroundColor: ["#3b82f6","#f59e42","#22c55e","#ef4444","#6366f1","#eab308","#14b8a6","#a21caf"],
    }]
  };

  // Bar: New students per month (last 6 months)
  const months = Array.from({length: 6}).map((_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const monthlyCounts = months.map(m =>
    students.filter(s => s.created_at?.startsWith(m)).length
  );
  const barData = {
    labels: months.map(m => {
      const [y,mo] = m.split("-");
      return `${y}/${mo}`;
    }),
    datasets: [{
      label: "الطلاب الجدد",
      data: monthlyCounts,
      backgroundColor: "#0ea5e9",
    }]
  };

  return (
    <div className="p-8" dir="rtl">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">لوحة البيانات</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader><CardTitle>إجمالي الطلاب</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{totalStudents}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>طلاب جدد هذا الشهر</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{newStudentsThisMonth}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>إجمالي الطلبات</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{totalApplications}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>إجمالي الدفعات</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{totalPayments} ريال</CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>التوزيع الجغرافي للطلاب</CardHeader>
              <CardContent>
                <Pie data={pieData} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>الطلاب الجدد (آخر 6 أشهر)</CardHeader>
              <CardContent>
                <Bar data={barData} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboardPage;

export default AdminDashboardPage;
