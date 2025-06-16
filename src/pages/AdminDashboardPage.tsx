import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

// Types
type Profile = {
  id: string;
  full_name: string;
  email: string;
  country: string;
  is_admin: boolean;
  intake_month?: string | null;
  notes?: string | null;
};

type Application = {
  id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  application_group: string;
  data?: any;
  student?: Profile;
};

type Payment = {
  id: string;
  student_id: string;
  amount_paid: number;
  amount_total: number;
  amount_remaining: number | null;
  payment_date: string | null;
  payment_status: string | null;
  notes?: string | null;
  student?: Profile;
};

type Document = {
  id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  upload_date: string;
  notes?: string | null;
  student?: Profile;
};

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState("students");
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // --- Students ---
  const [students, setStudents] = useState<Profile[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [showDelete, setShowDelete] = useState<Profile | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  // --- Applications ---
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // --- Payments ---
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentStudentFilter, setPaymentStudentFilter] = useState("");

  // --- Documents ---
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docStudentFilter, setDocStudentFilter] = useState("");

  // --- Admin check ---
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

  // --- Fetch students ---
  const fetchStudents = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setStudents(data);
  };

  // --- Fetch applications ---
  const fetchApplications = async () => {
    const { data } = await supabase
      .from("applications")
      .select("*, student:profiles(id, full_name, email, country)")
      .order("submitted_at", { ascending: false });
    if (data) setApplications(data as Application[]);
  };

  // --- Fetch payments ---
  const fetchPayments = async () => {
    const { data } = await supabase
      .from("payments")
      .select("*, student:profiles(id, full_name, email, country)");
    if (data) setPayments(data as Payment[]);
  };

  // --- Fetch documents ---
  const fetchDocuments = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*, student:profiles(id, full_name, email, country)");
    if (data) setDocuments(data as Document[]);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStudents();
      fetchApplications();
      fetchPayments();
      fetchDocuments();
    }
  }, [isAdmin]);

  // --- Student Management ---
  const filteredStudents = students.filter(
    (student) =>
      student.email?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.full_name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleEdit = (student: Profile) => setEditing(student);
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    setEditing({ ...editing, [e.target.name]: e.target.value });
  };
  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    setEditing({ ...editing, is_admin: e.target.checked });
  };
  const handleEditSave = async () => {
    if (!editing) return;
    setStudentLoading(true);
    await supabase
      .from("profiles")
      .update({
        full_name: editing.full_name,
        email: editing.email,
        country: editing.country,
        is_admin: editing.is_admin,
      })
      .eq("id", editing.id);
    setEditing(null);
    setStudentLoading(false);
    fetchStudents();
  };

  const handleDelete = (student: Profile) => setShowDelete(student);
  const handleDeleteConfirm = async () => {
    if (!showDelete) return;
    setStudentLoading(true);
    await supabase.from("profiles").delete().eq("id", showDelete.id);
    setShowDelete(null);
    setStudentLoading(false);
    fetchStudents();
  };

  // --- Applications ---
  const appGroups = Array.from(new Set(applications.map(app => app.application_group))).filter(Boolean);
  const filteredApps = groupFilter
    ? applications.filter(app => app.application_group === groupFilter)
    : applications;

  const handleChangeStatus = async (app: Application, newStatus: string) => {
    setStatusUpdating(app.id);
    await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", app.id);
    setStatusUpdating(null);
    fetchApplications();
  };

  // --- Payments ---
  const filteredPayments = paymentStudentFilter
    ? payments.filter((p) => p.student?.full_name?.includes(paymentStudentFilter) || p.student?.email?.includes(paymentStudentFilter))
    : payments;

  // --- Documents ---
  const filteredDocuments = docStudentFilter
    ? documents.filter((d) => d.student?.full_name?.includes(docStudentFilter) || d.student?.email?.includes(docStudentFilter))
    : documents;

  if (!isAdmin) return null;

  return (
    <div className="p-8">
      <Tabs defaultValue="students" value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="mb-6">
          <TabsTrigger value="students">الطلاب</TabsTrigger>
          <TabsTrigger value="applications">الطلبات</TabsTrigger>
          <TabsTrigger value="payments">الدفعات</TabsTrigger>
          <TabsTrigger value="documents">المستندات</TabsTrigger>
        </TabsList>
        {/* --- Students --- */}
        <TabsContent value="students">
          <Card>
            <CardHeader><CardTitle>إدارة الطلاب</CardTitle></CardHeader>
            <CardContent>
              <Input
                type="text"
                placeholder="بحث بالاسم أو البريد"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="mb-4"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full border text-right">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">الاسم</th>
                      <th className="px-4 py-2">البريد الإلكتروني</th>
                      <th className="px-4 py-2">الدولة</th>
                      <th className="px-4 py-2">مشرف؟</th>
                      <th className="px-4 py-2">تحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="border px-4 py-2">{student.full_name}</td>
                        <td className="border px-4 py-2">{student.email}</td>
                        <td className="border px-4 py-2">{student.country}</td>
                        <td className="border px-4 py-2">{student.is_admin ? "✔️" : ""}</td>
                        <td className="border px-4 py-2 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(student)}>تعديل</Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(student)}>حذف</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {/* Edit Modal */}
          {editing && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg mb-4">تعديل الطالب</h2>
                <Input
                  name="full_name"
                  value={editing.full_name}
                  onChange={handleEditChange}
                  placeholder="الاسم"
                  className="mb-2"
                />
                <Input
                  name="email"
                  value={editing.email}
                  onChange={handleEditChange}
                  placeholder="البريد الإلكتروني"
                  className="mb-2"
                />
                <Input
                  name="country"
                  value={editing.country}
                  onChange={handleEditChange}
                  placeholder="الدولة"
                  className="mb-2"
                />
                <label className="inline-flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={!!editing.is_admin}
                    onChange={handleAdminChange}
                    className="mr-2"
                  />
                  مشرف؟
                </label>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setEditing(null)} className="mr-2">إلغاء</Button>
                  <Button disabled={studentLoading} onClick={handleEditSave}>حفظ</Button>
                </div>
              </div>
            </div>
          )}
          {/* Delete Confirmation */}
          {showDelete && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg mb-4">تأكيد الحذف</h2>
                <p>هل أنت متأكد أنك تريد حذف الطالب <b>{showDelete.full_name}</b>؟ لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" onClick={() => setShowDelete(null)} className="mr-2">إلغاء</Button>
                  <Button variant="destructive" disabled={studentLoading} onClick={handleDeleteConfirm}>حذف</Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        {/* --- Applications --- */}
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>طلبات التقديم</CardTitle>
              <div className="flex items-center mt-2">
                <span className="mr-2">الدفعة:</span>
                <select
                  className="border px-2 py-1 rounded"
                  value={groupFilter}
                  onChange={e => setGroupFilter(e.target.value)}
                  dir="rtl"
                >
                  <option value="">الكل</option>
                  {appGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-right">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">الاسم</th>
                      <th className="px-4 py-2">البريد</th>
                      <th className="px-4 py-2">الدفعة</th>
                      <th className="px-4 py-2">الحالة</th>
                      <th className="px-4 py-2">تاريخ التقديم</th>
                      <th className="px-4 py-2">تحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((app) => (
                      <tr key={app.id}>
                        <td className="border px-4 py-2">{app.student?.full_name}</td>
                        <td className="border px-4 py-2">{app.student?.email}</td>
                        <td className="border px-4 py-2">{app.application_group}</td>
                        <td className="border px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded ${
                              app.status === "Approved"
                                ? "bg-green-100 text-green-800"
                                : app.status === "Rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {app.status === "Approved"
                              ? "مقبول"
                              : app.status === "Rejected"
                              ? "مرفوض"
                              : "معلق"}
                          </span>
                        </td>
                        <td className="border px-4 py-2">{app.submitted_at?.split("T")[0]}</td>
                        <td className="border px-4 py-2 flex flex-nowrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedApp(app)}
                          >
                            عرض
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            disabled={statusUpdating === app.id}
                            onClick={() => handleChangeStatus(app, "Approved")}
                          >
                            قبول
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={statusUpdating === app.id}
                            onClick={() => handleChangeStatus(app, "Rejected")}
                          >
                            رفض
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            {/* Application Details Modal */}
            {selectedApp && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h2 className="text-lg mb-4">تفاصيل الطلب</h2>
                  <div className="mb-2"><b>الاسم:</b> {selectedApp.student?.full_name}</div>
                  <div className="mb-2"><b>البريد:</b> {selectedApp.student?.email}</div>
                  <div className="mb-2"><b>الدفعة:</b> {selectedApp.application_group}</div>
                  <div className="mb-2"><b>الحالة:</b> {selectedApp.status}</div>
                  <div className="mb-2"><b>تاريخ التقديم:</b> {selectedApp.submitted_at?.split("T")[0]}</div>
                  <div className="mb-2"><b>بيانات إضافية:</b>
                    <pre>{JSON.stringify(selectedApp.data, null, 2)}</pre>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setSelectedApp(null)}>
                      إغلاق
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
        {/* --- Payments --- */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>سجل الدفعات</CardTitle>
              <div className="flex items-center mt-2">
                <span className="mr-2">البحث بالطالب:</span>
                <Input
                  className="w-64"
                  value={paymentStudentFilter}
                  onChange={e => setPaymentStudentFilter(e.target.value)}
                  placeholder="اسم الطالب أو البريد"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-right">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">الاسم</th>
                      <th className="px-4 py-2">المبلغ المدفوع</th>
                      <th className="px-4 py-2">المبلغ الكلي</th>
                      <th className="px-4 py-2">المتبقي</th>
                      <th className="px-4 py-2">الحالة</th>
                      <th className="px-4 py-2">تاريخ الدفع</th>
                      <th className="px-4 py-2">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="border px-4 py-2">{p.student?.full_name}</td>
                        <td className="border px-4 py-2">{p.amount_paid}</td>
                        <td className="border px-4 py-2">{p.amount_total}</td>
                        <td className="border px-4 py-2">{p.amount_remaining ?? "-"}</td>
                        <td className="border px-4 py-2">{p.payment_status ?? "-"}</td>
                        <td className="border px-4 py-2">{p.payment_date?.split("T")[0] ?? "-"}</td>
                        <td className="border px-4 py-2">{p.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* --- Documents --- */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>سجل المستندات</CardTitle>
              <div className="flex items-center mt-2">
                <span className="mr-2">البحث بالطالب:</span>
                <Input
                  className="w-64"
                  value={docStudentFilter}
                  onChange={e => setDocStudentFilter(e.target.value)}
                  placeholder="اسم الطالب أو البريد"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-right">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">الاسم</th>
                      <th className="px-4 py-2">اسم الملف</th>
                      <th className="px-4 py-2">تاريخ الرفع</th>
                      <th className="px-4 py-2">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td className="border px-4 py-2">{doc.student?.full_name}</td>
                        <td className="border px-4 py-2">{doc.file_name}</td>
                        <td className="border px-4 py-2">{doc.upload_date?.split("T")[0]}</td>
                        <td className="border px-4 py-2">{doc.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboardPage;


