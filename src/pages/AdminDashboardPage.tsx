
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

// CSV export helper
const downloadCSV = (rows: any[], fileName = "students.csv") => {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const csv = [
    header.join(","),
    ...rows.map(row =>
      header.map(fieldName =>
        `"${String(row[fieldName] ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ),
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  country: string;
  created_at?: string;
};

type Service = {
  id: string;
  created_at: string;
  service_type: string;
};

type Payment = {
  amount_paid: number;
};

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState<Profile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Students tab state
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      fetchStudents(),
      fetchServices(),
      fetchPayments()
    ]);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setStudents(data);
  };
  
  const fetchServices = async () => {
    const { data } = await supabase.from("services").select("*");
    if (data) setServices(data);
  };
  
  const fetchPayments = async () => {
    const { data } = await supabase.from("payments").select("amount_paid");
    if (data) setPayments(data);
  };

  // --- Analytics logic ---
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const totalStudents = students.length;
  const newStudentsThisMonth = students.filter(s => s.created_at?.startsWith(currentMonth)).length;
  const totalServices = services.length;
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // --- Students tab logic ---
  const allCountries = Array.from(new Set(students.map(s => s.country).filter(Boolean)));
  const studentsFiltered = students.filter(s =>
    (!countryFilter || s.country === countryFilter) &&
    (!search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id: string) => {
    setSelected(sel =>
      sel.includes(id) ? sel.filter(sid => sid !== id) : [...sel, id]
    );
  };
  const toggleSelectAll = () => {
    if (selected.length === studentsFiltered.length) {
      setSelected([]);
    } else {
      setSelected(studentsFiltered.map(s => s.id));
    }
  };

  const handleExport = () => {
    const toExport = students.filter(s => selected.includes(s.id));
    downloadCSV(toExport, "selected_students.csv");
  };

  const handleImpersonate = (studentId: string) => {
    setImpersonateId(studentId);
    // Implement your impersonation logic here
    // Example: navigate(`/student-dashboard?impersonate=${studentId}`);
    alert("Impersonate student: " + studentId);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm("هل أنت متأكد من حذف الطلاب المحددين؟")) return;
    setDeleting(true);
    await supabase.from("profiles").delete().in("id", selected);
    setSelected([]);
    await fetchStudents();
    setDeleting(false);
  };

  return (
    <div className="p-8" dir="rtl">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">لوحة البيانات</TabsTrigger>
          <TabsTrigger value="students">الطلاب</TabsTrigger>
        </TabsList>
        {/* Overview Tab */}
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
              <CardHeader><CardTitle>إجمالي الخدمات</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{totalServices}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>إجمالي الدفعات</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{totalPayments} شيكل</CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Students Tab */}
        <TabsContent value="students">
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <input
              type="text"
              className="border rounded px-3 py-1 w-64"
              placeholder="بحث بالاسم أو البريد"
              value={search}
              onChange={e => setSearch(e.target.value)}
              dir="rtl"
            />
            <select
              className="border rounded px-3 py-1"
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
            >
              <option value="">كل الدول</option>
              {allCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              className="bg-blue-600 text-white rounded px-4 py-1 ml-2"
              onClick={handleExport}
              disabled={selected.length === 0}
            >
              تصدير المحدد CSV
            </button>
            <button
              className="bg-red-600 text-white rounded px-4 py-1 ml-2"
              onClick={handleBulkDelete}
              disabled={selected.length === 0 || deleting}
            >
              حذف المحدد
            </button>
            <span className="ml-2 font-semibold">
              {selected.length > 0
                ? `تم تحديد ${selected.length} / ${studentsFiltered.length}`
                : `إجمالي: ${studentsFiltered.length}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th>
                    <input
                      type="checkbox"
                      checked={selected.length === studentsFiltered.length && studentsFiltered.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدولة</th>
                  <th>تاريخ التسجيل</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {studentsFiltered.map(s => (
                  <tr key={s.id} className={selected.includes(s.id) ? "bg-blue-50" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td>{s.full_name}</td>
                    <td>{s.email}</td>
                    <td>{s.country}</td>
                    <td>{s.created_at?.split("T")[0]}</td>
                    <td>
                      <button
                        className="bg-green-600 text-white rounded px-3 py-1 ml-1"
                        onClick={() => handleImpersonate(s.id)}
                      >
                        دخول كطالب
                      </button>
                    </td>
                  </tr>
                ))}
                {studentsFiltered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-gray-400">
                      لا يوجد طلاب مطابقين
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboardPage;
