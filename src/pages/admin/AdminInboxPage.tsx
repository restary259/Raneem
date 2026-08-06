import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ContactsManager from "@/components/admin/ContactsManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

type Submission = {
  id: string;
  form_source: string;
  data: any;
  status: string;
  created_at: string;
};

const SOURCES = ["all", "partnership", "contact"] as const;

const AdminInboxPage = () => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: t("common.error"), description: error.message });
    } else {
      setRows((data as Submission[]) || []);
    }
    setLoading(false);
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (source === "all") return true;
    const s = (r.form_source || "").toLowerCase();
    return source === "partnership" ? s.includes("partner") : !s.includes("partner");
  });

  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("admin.inbox.title", "Applications Inbox")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("admin.inbox.subtitle", "Partnership and contact form submissions")}
            </p>
          </div>
          {newCount > 0 && <Badge variant="destructive">{newCount}</Badge>}
        </div>
        <div className="flex gap-2">
          {SOURCES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={source === s ? "default" : "outline"}
              onClick={() => setSource(s)}
            >
              {t(`admin.inbox.source.${s}`, s)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ContactsManager contacts={filtered} onRefresh={load} />
      )}
    </div>
  );
};

export default AdminInboxPage;
