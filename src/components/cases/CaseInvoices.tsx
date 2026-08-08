import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Receipt, Plus, Send, CheckCircle2, Trash2, Ban } from "lucide-react";
import { formatILS } from "@/lib/money";
import { useInvoices, invoiceTotal, INVOICE_CATEGORIES, type Invoice } from "@/hooks/useInvoices";

interface CaseInvoicesProps {
  caseId: string;
  /** Staff (admin / assigned team member) can create and edit invoices. */
  canManage?: boolean;
}

const STATUS_TONE: Record<Invoice["status"], string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-amber-100 text-amber-800 border-amber-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  void: "bg-rose-100 text-rose-700 border-rose-200",
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-US") : "—");

const CaseInvoices: React.FC<CaseInvoicesProps> = ({ caseId, canManage = false }) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { invoices, isLoading, refetch } = useInvoices(caseId);
  const [busy, setBusy] = useState(false);
  const [openItemForm, setOpenItemForm] = useState<string | null>(null);
  const [draftItem, setDraftItem] = useState({
    description: "",
    category: "service_fee",
    amount: "",
    quantity: "1",
  });

  const fail = (e: any) => toast({ variant: "destructive", description: e?.message ?? t("invoices.error") });

  const createInvoice = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("invoices")
        .insert({ case_id: caseId, status: "draft", currency: "ILS" });
      if (error) throw error;
      toast({ description: t("invoices.created") });
      refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (invoice: Invoice, status: Invoice["status"]) => {
    if (status === "sent" && invoice.items.length === 0) {
      toast({ variant: "destructive", description: t("invoices.needItems") });
      return;
    }
    setBusy(true);
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "sent" && !invoice.issued_at) patch.issued_at = new Date().toISOString();
      const { error } = await (supabase as any).from("invoices").update(patch).eq("id", invoice.id);
      if (error) throw error;
      refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteInvoice = async (invoice: Invoice) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("invoices").delete().eq("id", invoice.id);
      if (error) throw error;
      refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (invoiceId: string) => {
    const amount = Number(draftItem.amount);
    const quantity = Number(draftItem.quantity);
    if (!draftItem.description.trim() || !Number.isFinite(amount) || amount < 0 || !(quantity > 0)) {
      toast({ variant: "destructive", description: t("invoices.invalidItem") });
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("invoice_items").insert({
        invoice_id: invoiceId,
        description: draftItem.description.trim().slice(0, 200),
        category: draftItem.category,
        amount,
        quantity,
      });
      if (error) throw error;
      setDraftItem({ description: "", category: "service_fee", amount: "", quantity: "1" });
      setOpenItemForm(null);
      refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("invoice_items").delete().eq("id", itemId);
      if (error) throw error;
      refetch();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const grandTotal = invoices.filter((inv) => inv.status !== "void").reduce((sum, inv) => sum + inv.total, 0);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          {t("invoices.title")}
          {invoices.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {t("invoices.grandTotal")}: {formatILS(grandTotal)}
            </span>
          )}
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={createInvoice} disabled={busy}>
            <Plus className="h-4 w-4 me-1" />
            {t("invoices.new")}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("invoices.loading")}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t("invoices.empty")}</p>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{invoice.invoice_number ?? "—"}</span>
                  <Badge variant="outline" className={STATUS_TONE[invoice.status]}>
                    {t(`invoices.status.${invoice.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("invoices.issuedAt")}: {formatDate(invoice.issued_at ?? invoice.created_at)}
                  </span>
                </div>
                <span className="font-semibold text-sm">{formatILS(invoice.total)}</span>
              </div>

              {invoice.items.length > 0 && (
                <div className="space-y-1">
                  {invoice.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-sm bg-muted/30 rounded px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(`invoices.category.${item.category}`)}
                          {Number(item.quantity) !== 1 && ` × ${item.quantity}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>{formatILS(Number(item.amount) * Number(item.quantity))}</span>
                        {canManage && invoice.status === "draft" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => removeItem(item.id)}
                            disabled={busy}
                            aria-label={t("invoices.removeItem")}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-medium">
                    <span>{t("invoices.total")}</span>
                    <span>{formatILS(invoiceTotal(invoice.items))}</span>
                  </div>
                </div>
              )}

              {canManage && invoice.status === "draft" && (
                <div className="space-y-2">
                  {openItemForm === invoice.id ? (
                    <div className="grid gap-2 sm:grid-cols-4 items-end">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">{t("invoices.itemDescription")}</Label>
                        <Input
                          value={draftItem.description}
                          onChange={(e) => setDraftItem((d) => ({ ...d, description: e.target.value }))}
                          maxLength={200}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t("invoices.itemCategory")}</Label>
                        <Select
                          value={draftItem.category}
                          onValueChange={(v) => setDraftItem((d) => ({ ...d, category: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVOICE_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {t(`invoices.category.${c}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{t("invoices.itemAmount")}</Label>
                          <Input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            value={draftItem.amount}
                            onChange={(e) => setDraftItem((d) => ({ ...d, amount: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("invoices.itemQuantity")}</Label>
                          <Input
                            type="number"
                            min={1}
                            value={draftItem.quantity}
                            onChange={(e) => setDraftItem((d) => ({ ...d, quantity: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-4 flex gap-2">
                        <Button size="sm" onClick={() => addItem(invoice.id)} disabled={busy}>
                          {t("invoices.saveItem")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setOpenItemForm(null)} disabled={busy}>
                          {t("invoices.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setOpenItemForm(invoice.id)} disabled={busy}>
                      <Plus className="h-4 w-4 me-1" />
                      {t("invoices.addItem")}
                    </Button>
                  )}
                </div>
              )}

              {canManage && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {invoice.status === "draft" && (
                    <>
                      <Button size="sm" onClick={() => setStatus(invoice, "sent")} disabled={busy}>
                        <Send className="h-4 w-4 me-1" />
                        {t("invoices.send")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteInvoice(invoice)}
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4 me-1" />
                        {t("invoices.delete")}
                      </Button>
                    </>
                  )}
                  {invoice.status === "sent" && (
                    <>
                      <Button size="sm" onClick={() => setStatus(invoice, "paid")} disabled={busy}>
                        <CheckCircle2 className="h-4 w-4 me-1" />
                        {t("invoices.markPaid")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(invoice, "void")} disabled={busy}>
                        <Ban className="h-4 w-4 me-1" />
                        {t("invoices.void")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default CaseInvoices;
