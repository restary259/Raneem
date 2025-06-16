import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Profile } from "@/types/profile";
import { useNavigate } from "react-router-dom";

const emptyProfile = {
  id: "",
  full_name: "",
  email: "",
  country: "",
  is_admin: false,
};

const AdminDashboardPage = () => {
  const [students, setStudents] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [showDelete, setShowDelete] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const fetchStudents = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setStudents(data);
  };

  useEffect(() => {
    if (isAdmin) fetchStudents();
  }, [isAdmin]);

  const filtered = students.filter(
    (student) =>
      student.email?.toLowerCase().includes(search.toLowerCase()) ||
      student.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Edit Handlers
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

  // Delete Handlers
  const handleDelete = (student: Profile) => setShowDelete(student);
  const handleDeleteConfirm = async () => {
    if (!showDelete) return;
    setLoading(true);
    await supabase.from("profiles").delete().eq("id", showDelete.id);
    setShowDelete(null);
    setLoading(false);
    fetchStudents();
  };

  if (!isAdmin) return null;

  return (
    <div className="p-8">
      <Card>
        <CardHeader><CardTitle>لوحة تحكم المشرف</CardTitle></CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="بحث بالاسم أو البريد"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                {filtered.map((student) => (
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
    </div>
  );
};

export default AdminDashboardPage;
