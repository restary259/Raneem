
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

const downloadCSV = (rows: any[], fileName = "students.csv") => {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const csv = [
    header.join(","),
    ...rows.map(row => header.map(f => `"${String(row[f] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

type Profile = { id: string; full_name: string; email: string; country: string; created_at?: string };
type Payment = { amount_paid: number };

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState<Profile[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    const [p, s, pay] = await Promise.all([
      (supabase as any).from("profiles").select("*"),
      (supabase as any).from("services").select("*"),
      (supabase as any).from("payments").select("amount"),
    ]);
    if (p.data) setStudents(p.data);
    if (s.data) setServices(s.data);
    if (pay.data) setPayments(pay.data.map((d: any) => ({ amount_paid: d.amount || 0 })));
  };

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const totalStudents = students.length;
  const newStudentsThisMonth = students.filter(s => s.created_at?.startsWith(currentMonth)).length;
  const totalServices = services.length;
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  const allCountries = Array.from(new Set(students.map(s => s.country).filter(Boolean)));
  const studentsFiltered = students.filter(s =>
    (!countryFilter || s.country === countryFilter) &&
    (!search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id: string) => setSelected(sel => sel.includes(id) ? sel.filter(sid => sid !== id) : [...sel, id]);
  const toggleSelectAll = () => setSelected(selected.length === studentsFiltered.length ? [] : studentsFiltered.map(s => s.id));

  const handleBulkDelete = async () => {
    if (!window.confirm("هل أنت متأكد من حذف الطلاب المحددين؟")) return;
    setDeleting(true);
    await (supabase as any).from("profiles").delete().in("id", selected);
    setSelected([]);
    await fetchAllData();
    setDeleting(false);
  };

  return (
    <div className="p-8" dir="rtl">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">لوحة البيانات</TabsTrigger>
          <TabsTrigger value="students">الطلاب</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card><CardHeader><CardTitle>إجمالي الطلاب</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{totalStudents}</CardContent></Card>
            <Card><CardHeader><CardTitle>طلاب جدد هذا الشهر</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{newStudentsThisMonth}</CardContent></Card>
            <Card><CardHeader><CardTitle>إجمالي الخدمات</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{totalServices}</CardContent></Card>
            <Card><CardHeader><CardTitle>إجمالي الدفعات</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{totalPayments} ₪</CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="students">
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <input type="text" className="border rounded px-3 py-1 w-64" placeholder="بحث بالاسم أو البريد" value={search} onChange={e => setSearch(e.target.value)} dir="rtl" />
            <select className="border rounded px-3 py-1" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
              <option value="">كل الدول</option>
              {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="bg-blue-600 text-white rounded px-4 py-1" onClick={() => downloadCSV(students.filter(s => selected.includes(s.id)), "selected_students.csv")} disabled={selected.length === 0}>تصدير CSV</button>
            <button className="bg-red-600 text-white rounded px-4 py-1" onClick={handleBulkDelete} disabled={selected.length === 0 || deleting}>حذف المحدد</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead><tr className="bg-gray-100"><th><input type="checkbox" checked={selected.length === studentsFiltered.length && studentsFiltered.length > 0} onChange={toggleSelectAll} /></th><th>الاسم</th><th>البريد</th><th>الدولة</th><th>تاريخ التسجيل</th></tr></thead>
              <tbody>
                {studentsFiltered.map(s => (
                  <tr key={s.id} className={selected.includes(s.id) ? "bg-blue-50" : ""}>
                    <td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                    <td>{s.full_name}</td><td>{s.email}</td><td>{s.country}</td><td>{s.created_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboardPage;
