import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ContactsManager from "@/components/admin/ContactsManager";
import RecruitApplicationsPanel from "@/components/admin/RecruitApplicationsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Inbox, Search, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

type Submission = {
  id: string;
  form_source: string;
  data: any;
  status: string;
  created_at: string;
};

const downloadCSV = (rows: any[], fileName = "export.csv") => {
  if (!rows.length) return;
  const header = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      header.map((f) => `"${String(row[f] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

const isPartnership = (row: Submission) =>
  (row.form_source || "").toLowerCase().includes("partner");

const AdminInboxPage = () => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "partnership" | "contact" | "recruits">("all");
  const [search, setSearch] = useState("");
  const [recruitCount, setRecruitCount] = useState(0);
  const [recruitPending, setRecruitPending] = useState(0);

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

  const handleRecruitCount = useCallback((total: number, pending: number) => {
    setRecruitCount(total);
    setRecruitPending(pending);
  }, []);

  const matchesSearch = useCallback(
    (r: Submission) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const d = r.data || {};
      return [d.name, d.full_name, d.email, d.phone, d.whatsapp]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    },
    [search]
  );

  const searched = useMemo(() => rows.filter(matchesSearch), [rows, matchesSearch]);

  const partnership = useMemo(() => searched.filter(isPartnership), [searched]);
  const contact = useMemo(() => searched.filter((r) => !isPartnership(r)), [searched]);

  const visible = tab === "partnership" ? partnership : tab === "contact" ? contact : searched;

  const newCount = rows.filter((r) => r.status === "new").length;

  const exportRows = () => {
    if (tab === "recruits") {
      toast({ title: t("admin.inbox.exportRecruits", "Switch to a submissions tab to export") });
      return;
    }
    downloadCSV(
      visible.map((c) => ({ ...c.data, status: c.status, source: c.form_source, date: c.created_at })),
      `inbox-${tab}.csv`
    );
  };

  const tabLabel = (key: string, fallback: string, count: number) => (
    <span className="flex items-center gap-1.5">
      {t(key, fallback)}
      <span className="text-xs text-muted-foreground">{count.toLocaleString("en-US")}</span>
    </span>
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t("admin.inbox.title", "Applications Inbox")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.inbox.subtitle", "Partnership and contact form submissions")}
          </p>
        </div>
        {newCount > 0 && <Badge variant="destructive" className="ms-auto">{newCount}</Badge>}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        {/* Toolbar: search + export on top, tabs directly beneath */}
        <div className="sticky top-14 z-10 -mx-4 sm:-mx-6 space-y-3 bg-background/95 px-4 sm:px-6 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-10"
                placeholder={t("admin.inbox.searchPlaceholder", "Search by name, email or phone")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportRows}>
              <Download className="h-4 w-4 me-2" />
              {t("admin.contacts.export", "Export")}
            </Button>
          </div>

          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">
              {tabLabel("admin.inbox.source.all", "All", searched.length)}
            </TabsTrigger>
            <TabsTrigger value="partnership">
              {tabLabel("admin.inbox.source.partnership", "Partnership", partnership.length)}
            </TabsTrigger>
            <TabsTrigger value="contact">
              {tabLabel("admin.inbox.source.contact", "Contact", contact.length)}
            </TabsTrigger>
            <TabsTrigger value="recruits" className="gap-1.5">
              {tabLabel("admin.inbox.source.recruits", "Recruits", recruitCount)}
              {recruitPending > 0 && (
                <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                  {recruitPending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-0">
              <ContactsManager contacts={visible} onRefresh={load} />
            </TabsContent>
            <TabsContent value="partnership" className="mt-0">
              <ContactsManager contacts={partnership} onRefresh={load} />
            </TabsContent>
            <TabsContent value="contact" className="mt-0">
              <ContactsManager contacts={contact} onRefresh={load} />
            </TabsContent>
          </>
        )}

        {/* Mounted always so the tab badge stays accurate. */}
        <TabsContent value="recruits" forceMount className={tab === "recruits" ? "mt-0" : "hidden"}>
          <RecruitApplicationsPanel search={search} onCount={handleRecruitCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminInboxPage;
