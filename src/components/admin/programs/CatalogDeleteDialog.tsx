import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2 } from "lucide-react";

export type CatalogKind = "school" | "program" | "accommodation";

export interface CatalogDeleteTarget {
  kind: CatalogKind;
  id: string;
  name: string;
}

interface DependencyReport {
  counts: Record<string, number>;
  child_programs: number;
  child_accommodations: number;
  blocking_total: number;
  can_delete: boolean;
}

interface Props {
  target: CatalogDeleteTarget | null;
  onClose: () => void;
  /** Called after a successful delete so the parent can refetch. */
  onDeleted: () => void;
  /** Offered when deletion is blocked. */
  onDeactivate?: (target: CatalogDeleteTarget) => void;
}

// The generated types do not yet include the catalog RPCs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase as unknown as any;

/**
 * Single confirmation surface for permanently deleting a catalog record.
 * The backend RPCs are the authority: the report drives what we show, and the
 * delete RPC re-checks the admin role and the dependencies inside its own
 * transaction, so nothing here can be bypassed from the client.
 */
const CatalogDeleteDialog = ({ target, onClose, onDeleted, onDeactivate }: Props) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [report, setReport] = useState<DependencyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!target) {
      setReport(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setReport(null);
    (async () => {
      const { data, error } = await db.rpc("catalog_dependency_report", {
        p_kind: target.kind,
        p_id: target.id,
      });
      if (cancelled) return;
      setLoading(false);
      if (error) {
        toast({ variant: "destructive", description: error.message });
        return;
      }
      setReport(data as DependencyReport);
    })();
    return () => {
      cancelled = true;
    };
  }, [target, toast]);

  const runDelete = async () => {
    if (!target) return;
    setDeleting(true);
    const { error } = await db.rpc("delete_catalog_entity", { p_kind: target.kind, p_id: target.id });
    setDeleting(false);
    if (error) {
      toast({
        variant: "destructive",
        description: error.message?.includes("CATALOG_DELETE_BLOCKED")
          ? t("admin.programs.deleteBlocked", "This record is still in use and cannot be deleted.")
          : error.message,
      });
      return;
    }
    toast({ description: t("admin.programs.deleteDone", "Deleted permanently.") });
    onClose();
    onDeleted();
  };

  const blockers = report
    ? Object.entries(report.counts).filter(([, n]) => Number(n) > 0)
    : [];

  const labelFor = (key: string) =>
    ({
      case_submissions: t("admin.programs.depCases", "Student submissions"),
      child_case_submissions: t("admin.programs.depChildCases", "Student submissions on its programs / housing"),
      service_catalog: t("admin.programs.depServices", "Service catalog entries"),
      child_service_catalog: t("admin.programs.depChildServices", "Service entries on its programs / housing"),
      important_contacts: t("admin.programs.depContacts", "Important contacts"),
      profiles: t("admin.programs.depProfiles", "Student profiles"),
    }[key] ?? key);

  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.programs.deleteTitle", "Delete permanently?")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                {t("admin.programs.deleteBody", "This permanently removes")}{" "}
                <span className="font-semibold text-foreground">{target?.name}</span>.{" "}
                {t("admin.programs.deleteIrreversible", "This action cannot be undone.")}
              </p>

              {loading && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("admin.programs.deleteChecking", "Checking dependencies…")}
                </span>
              )}

              {report && target?.kind === "school" && report.can_delete &&
                (report.child_programs > 0 || report.child_accommodations > 0) && (
                  <p className="rounded-md border border-border bg-muted/40 p-3 text-muted-foreground">
                    {t("admin.programs.deleteChildren", "Its unused catalog entries are removed too:")}{" "}
                    {report.child_programs.toLocaleString("en-US")}{" "}
                    {t("admin.programs.tabPrograms", "Programs")} ·{" "}
                    {report.child_accommodations.toLocaleString("en-US")}{" "}
                    {t("admin.programs.tabAccommodations", "Accommodations")}
                  </p>
                )}

              {report && !report.can_delete && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <span className="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {t("admin.programs.deleteBlocked", "This record is still in use and cannot be deleted.")}
                  </span>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {blockers.map(([key, n]) => (
                      <li key={key}>
                        {labelFor(key)}: {Number(n).toLocaleString("en-US")}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    {t("admin.programs.deleteUseDeactivate", "Deactivate it instead to hide it from new cases while keeping history intact.")}
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          {report && !report.can_delete && onDeactivate && target && (
            <AlertDialogAction
              onClick={() => {
                onDeactivate(target);
                onClose();
              }}
            >
              {t("admin.programs.btnPause", "Deactivate")}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              runDelete();
            }}
            disabled={!report || !report.can_delete || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? t("common.loading") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CatalogDeleteDialog;
