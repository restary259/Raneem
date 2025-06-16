import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Profile } from "@/types/profile";
import { useNavigate } from "react-router-dom";

const AdminDashboardPage = () => {
  const [students, setStudents] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
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

  useEffect(() => {
    if (isAdmin) fetchStudents();
    async function fetchStudents() {
      const { data } = await supabase.from("profiles").select("*");
      if (data) setStudents(data);
    }
  }, [isAdmin]);

  const filtered = students.filter(
    (student) =>
      student.email?.toLowerCase().includes(search.toLowerCase()) ||
      student.full_name?.toLowerCase().includes(search.toLowerCase())
  );

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
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <td className="border px-4 py-2">{student.full_name}</td>
                    <td className="border px-4 py-2">{student.email}</td>
                    <td className="border px-4 py-2">{student.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
