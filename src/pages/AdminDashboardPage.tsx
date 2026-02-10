
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { Shield, AlertTriangle } from "lucide-react";

const downloadCSV = (rows: any[], fileName = "export.csv") => {
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

const AdminDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/student-auth');
        return;
      }
      setUser(session.user);

      // Server-side admin verification via edge function
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'dashboard_access' }),
        });

        const result = await resp.json();
        if (!result.isAdmin) {
          toast({ variant: "destructive", title: "غير مصرح", description: "ليس لديك صلاحية الوصول." });
          navigate('/');
          return;
        }
      } catch {
        toast({ variant: "destructive", title: "خطأ", description: "فشل التحقق من الصلاحيات." });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await fetchAllData();
      setIsLoading(false);
    };

    init();
  }, [navigate, toast]);

  const fetchAllData = async () => {
    const [p, s, pay, docs, con, audit, logins] = await Promise.all([
      (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("services").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("payments").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("documents").select("id, student_id, file_name, category, file_type, file_size, created_at, expiry_date").order("created_at", { ascending: false }),
      (supabase as any).from("contact_submissions").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("login_attempts").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (p.data) setStudents(p.data);
    if (s.data) setServices(s.data);
    if (pay.data) setPayments(pay.data);
    if (docs.data) setDocuments(docs.data);
    if (con.data) setContacts(con.data);
    if (audit.data) setAuditLogs(audit.data);
    if (logins.data) setLoginAttempts(logins.data);
  };

  const updateContactStatus = async (id: string, status: string) => {
    await (supabase as any).from("contact_submissions").update({ status }).eq("id", id);
    await fetchAllData();
    toast({ title: "تم تحديث الحالة" });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="text-lg">جاري التحميل...</div></div>;
  if (!isAdmin) return null;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const totalStudents = students.length;
  const newThisMonth = students.filter((s: any) => s.created_at?.startsWith(currentMonth)).length;
  const totalPayments = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const newContacts = contacts.filter((c: any) => c.status === 'new').length;

  // Security alerts: 10+ failed logins for same email in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentFailed = loginAttempts.filter(a => !a.success && a.created_at >= oneHourAgo);
  const emailCounts: Record<string, number> = {};
  recentFailed.forEach(a => { emailCounts[a.email] = (emailCounts[a.email] || 0) + 1; });
  const suspiciousEmails = Object.entries(emailCounts).filter(([, c]) => c >= 10);

  const filteredStudents = students.filter((s: any) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredContacts = contacts.filter((c: any) =>
    !contactSearch ||
    c.data?.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.data?.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم المدير</h1>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{user?.email}</Badge>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>العودة للموقع</Button>
          </div>
        </div>
      </header>

      {suspiciousEmails.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-red-800">تنبيه أمني</h3>
              <p className="text-sm text-red-700">
                محاولات تسجيل دخول مشبوهة ({suspiciousEmails.map(([e, c]) => `${e}: ${c} محاولة`).join(', ')})
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="students">الطلاب ({totalStudents})</TabsTrigger>
            <TabsTrigger value="contacts">رسائل التواصل ({newContacts} جديد)</TabsTrigger>
            <TabsTrigger value="documents">المستندات ({documents.length})</TabsTrigger>
            <TabsTrigger value="services">الخدمات ({services.length})</TabsTrigger>
            <TabsTrigger value="payments">المدفوعات</TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              الأمان
            </TabsTrigger>
            <TabsTrigger value="audit">سجل النشاط</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي الطلاب</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{totalStudents}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">طلاب جدد هذا الشهر</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-green-600">{newThisMonth}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">رسائل جديدة</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-orange-600">{newContacts}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي المدفوعات</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{totalPayments} ₪</CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">المستندات المرفوعة</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{documents.length}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">الخدمات النشطة</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{services.filter((s: any) => s.status !== 'completed').length}</CardContent></Card>
            </div>
          </TabsContent>

          {/* Students */}
          <TabsContent value="students">
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <input type="text" className="border rounded px-3 py-2 w-64" placeholder="بحث بالاسم أو البريد" value={search} onChange={e => setSearch(e.target.value)} />
              <Button variant="outline" onClick={() => downloadCSV(filteredStudents, "students.csv")}>تصدير CSV</Button>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3 text-right">الاسم</th><th className="px-4 py-3 text-right">البريد</th><th className="px-4 py-3 text-right">الهاتف</th><th className="px-4 py-3 text-right">حالة الفيزا</th><th className="px-4 py-3 text-right">الجامعة</th><th className="px-4 py-3 text-right">تاريخ التسجيل</th></tr></thead>
                <tbody>
                  {filteredStudents.map((s: any) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3">{s.email}</td>
                      <td className="px-4 py-3">{s.phone_number || '—'}</td>
                      <td className="px-4 py-3"><Badge variant={s.visa_status === 'approved' ? 'default' : 'secondary'}>{s.visa_status}</Badge></td>
                      <td className="px-4 py-3">{s.university_name || '—'}</td>
                      <td className="px-4 py-3">{s.created_at?.split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.length === 0 && <p className="p-8 text-center text-muted-foreground">لا يوجد طلاب</p>}
            </div>
          </TabsContent>

          {/* Contact Submissions */}
          <TabsContent value="contacts">
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <input type="text" className="border rounded px-3 py-2 w-64" placeholder="بحث في الرسائل" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
              <Button variant="outline" onClick={() => downloadCSV(contacts.map((c: any) => ({ ...c.data, status: c.status, date: c.created_at })), "contacts.csv")}>تصدير CSV</Button>
            </div>
            <div className="space-y-4">
              {filteredContacts.map((c: any) => (
                <Card key={c.id} className={c.status === 'new' ? 'border-orange-300 bg-orange-50/50' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{c.data?.name || 'بدون اسم'}</h3>
                        <p className="text-sm text-muted-foreground">{c.data?.email} • {c.data?.whatsapp || 'بدون واتساب'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.status === 'new' ? 'destructive' : c.status === 'replied' ? 'default' : 'secondary'}>
                          {c.status === 'new' ? 'جديد' : c.status === 'replied' ? 'تم الرد' : c.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{c.created_at?.split("T")[0]}</span>
                      </div>
                    </div>
                    <p className="text-sm"><strong>الخدمة:</strong> {c.data?.service || '—'} | <strong>الوجهة:</strong> {c.data?.studyDestination || '—'}</p>
                    {c.data?.message && <p className="mt-2 text-sm bg-gray-50 p-3 rounded">{c.data.message}</p>}
                    <div className="mt-3 flex gap-2">
                      {c.status === 'new' && <Button size="sm" onClick={() => updateContactStatus(c.id, 'replied')}>تم الرد</Button>}
                      {c.status !== 'archived' && <Button size="sm" variant="outline" onClick={() => updateContactStatus(c.id, 'archived')}>أرشفة</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredContacts.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد رسائل</p>}
            </div>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3 text-right">اسم الملف</th><th className="px-4 py-3 text-right">الفئة</th><th className="px-4 py-3 text-right">النوع</th><th className="px-4 py-3 text-right">الحجم</th><th className="px-4 py-3 text-right">تاريخ الانتهاء</th><th className="px-4 py-3 text-right">تاريخ الرفع</th></tr></thead>
                <tbody>
                  {documents.map((d: any) => (
                    <tr key={d.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{d.file_name}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{d.category}</Badge></td>
                      <td className="px-4 py-3">{d.file_type || '—'}</td>
                      <td className="px-4 py-3">{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}</td>
                      <td className="px-4 py-3">{d.expiry_date || '—'}</td>
                      <td className="px-4 py-3">{d.created_at?.split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {documents.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد مستندات</p>}
            </div>
          </TabsContent>

          {/* Services */}
          <TabsContent value="services">
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3 text-right">نوع الخدمة</th><th className="px-4 py-3 text-right">الحالة</th><th className="px-4 py-3 text-right">ملاحظات</th><th className="px-4 py-3 text-right">التاريخ</th></tr></thead>
                <tbody>
                  {services.map((s: any) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.service_type}</td>
                      <td className="px-4 py-3"><Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>{s.status}</Badge></td>
                      <td className="px-4 py-3">{s.notes || '—'}</td>
                      <td className="px-4 py-3">{s.created_at?.split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {services.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد خدمات</p>}
            </div>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3 text-right">المبلغ</th><th className="px-4 py-3 text-right">العملة</th><th className="px-4 py-3 text-right">الحالة</th><th className="px-4 py-3 text-right">التاريخ</th><th className="px-4 py-3 text-right">ملاحظات</th></tr></thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold">{p.amount}</td>
                      <td className="px-4 py-3">{p.currency}</td>
                      <td className="px-4 py-3"><Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>{p.status}</Badge></td>
                      <td className="px-4 py-3">{p.payment_date?.split("T")[0] || p.created_at?.split("T")[0]}</td>
                      <td className="px-4 py-3">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد مدفوعات</p>}
            </div>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> محاولات تسجيل الدخول الأخيرة</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3 text-right">البريد</th><th className="px-4 py-3 text-right">IP</th><th className="px-4 py-3 text-right">النتيجة</th><th className="px-4 py-3 text-right">التاريخ</th></tr></thead>
                      <tbody>
                        {loginAttempts.slice(0, 50).map((a: any) => (
                          <tr key={a.id} className={`border-b ${!a.success ? 'bg-red-50/50' : ''}`}>
                            <td className="px-4 py-3">{a.email}</td>
                            <td className="px-4 py-3 font-mono text-xs">{a.ip_address || '—'}</td>
                            <td className="px-4 py-3">
                              <Badge variant={a.success ? 'default' : 'destructive'}>{a.success ? 'نجاح' : 'فشل'}</Badge>
                            </td>
                            <td className="px-4 py-3 text-xs">{new Date(a.created_at).toLocaleString('ar')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {loginAttempts.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد محاولات</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audit Log */}
          <TabsContent value="audit">
            <Card>
              <CardHeader><CardTitle>سجل نشاط المدير</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-3 text-right">الإجراء</th><th className="px-4 py-3 text-right">الجدول</th><th className="px-4 py-3 text-right">التفاصيل</th><th className="px-4 py-3 text-right">التاريخ</th></tr></thead>
                    <tbody>
                      {auditLogs.map((log: any) => (
                        <tr key={log.id} className="border-b">
                          <td className="px-4 py-3 font-medium">{log.action}</td>
                          <td className="px-4 py-3">{log.target_table || '—'}</td>
                          <td className="px-4 py-3 text-xs">{log.details || '—'}</td>
                          <td className="px-4 py-3 text-xs">{new Date(log.created_at).toLocaleString('ar')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditLogs.length === 0 && <p className="p-8 text-center text-muted-foreground">لا يوجد نشاط مسجل</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
