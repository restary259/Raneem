// src/pages/TeamStudentsPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, UserPlus, User, Mail, Phone, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  must_change_password: boolean;
  city: string | null;
  created_by: string | null;
}

export default function TeamStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});

  const fetchStudents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // 1. Try to get students via roles
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "student");

      let studentIds = (roleData ?? []).map((r: any) => r.user_id);

      // 2. Fallback if no roles found
      if (studentIds.length === 0) {
        const { data: fallback } = await supabase.from("profiles").select("id").eq("must_change_password", true);
        studentIds = (fallback ?? []).map((p: any) => p.id);
      }

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      // 3. Get full profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number, created_at, must_change_password, city, created_by")
        .in("id", studentIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setStudents((profiles as StudentProfile[]) ?? []);

      // 4. Get creator names
      const creatorIds = [...new Set((profiles ?? []).map((p) => p.created_by).filter(Boolean))];
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", creatorIds as string[]);

        const map: Record<string, string> = {};
        (creators ?? []).forEach((p) => {
          map[p.id] = p.full_name || p.email;
        });
        setCreatorNames(map);
      }
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">{isRtl ? "الطلاب" : "Students"}</h1>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchStudents} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={fetchStudents} disabled={loading}><UserPlus className="h-4 w-4 me-1" />{isRtl ? "إضافة طالب" : "Add Student"}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <User className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">{isRtl ? "لا يوجد طلاب بعد" : "No students yet"}</p>
          <p className="text-sm mt-1">{isRtl ? "أنشئ حساب طالب جديد" : "Create a student account to begin"}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {students.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold truncate">{student.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {student.email}
                    </p>
                    {student.phone_number && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {student.phone_number}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
                      {student.must_change_password && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">
                          Temporary Password
                        </Badge>
                      )}
                      <span>{formatDistanceToNow(new Date(student.created_at), { addSuffix: true })}</span>
                      {student.created_by && (
                        <span>· By {creatorNames[student.created_by] || student.created_by.slice(0, 8) + "..."}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
