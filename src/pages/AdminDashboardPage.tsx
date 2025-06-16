import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

// Types
type Profile = {
  id: string;
  full_name: string;
  email: string;
  country: string;
  is_admin: boolean;
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

const AdminDashboardPage = () => {
  const [students, setStudents] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [showDelete, setShowDelete] = useState<Profile | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

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

  // Fetch students
  const fetchStudents = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setStudents(data);
  };

  // Fetch applications
  const fetchApplications = async () => {
    const { data } = await supabase
      .from("applications")
      .select("*, student:profiles(id, full_name, email, country)")
      .order("submitted_at", { ascending: false });
    if (data) setApplications(data as Application[]);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStudents();
      fetchApplications();
    }
  }, [isAdmin]);

  // --- Student Section Logic ---

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
    setLoading(true);
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
    setLoading(false);
    fetchStudents();
  };

  const handleDelete = (student: Profile) => setShowDelete(student);
  const handleDeleteConfirm = async () => {
    if (!showDelete) return;
    setLoading(true);
    await supabase.from("profiles").delete().eq("id", showDelete.id);
    setShowDelete(null);
    setLoading(false);
    fetchStudents();
  };

  // --- Application Section Logic ---

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

  if (!isAdmin) return null;

  return (
    <div className="p-8 space-y-8">
      {/* --- Student Management Section --- */}
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
                    <td className="border px-4 py-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(student)}>تعديل</Button>
                      <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleDelete(student)}>حذف</Button>
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
              <Button disabled={loading} onClick={handleEditSave}>حفظ</Button>
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
              <Button variant="destructive" disabled={loading} onClick={handleDeleteConfirm}>حذف</Button>
            </div>
          </div>
        </div>
      )}

      {/* --- Application Management Section --- */}
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
                <option key={group} value={group}>
                  {group}
                </option>
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
                    <td className="border px-4 py-2">
                      {app.submitted_at?.split("T")[0]}
                    </td>
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
      </Card>

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
            <div className="mb-2"><b>بيانات إضافية:</b> <pre>{JSON.stringify(selectedApp.data, null, 2)}</pre></div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelectedApp(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
export default AdminDashboardPage;
