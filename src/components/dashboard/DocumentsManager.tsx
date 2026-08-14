import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { logDocumentAccess } from "@/lib/documentAccessLog";
import { validateUploadFile } from "@/lib/uploadRules";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, File, Download, Trash2, Plus, Search, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { LoadingState, EmptyState, ErrorState, TablePagination, usePagination, useDebouncedValue } from "@/components/shell";
import { toneClasses } from "@/lib/statusTokens";

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  category: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  service_id?: string;
}

interface DocumentsManagerProps {
  userId: string;
}

const CATEGORY_KEYS = [
  "passport",
  "certificate",
  "translation",
  "visa",
  "university_letter",
  "language",
  "insurance",
  "financial",
  "housing",
  "other",
];

// Normalise file_url to a storage path regardless of whether it was stored
// as a bare path ("userId/file.pdf") or a full public URL.
// Admin uploads store the full getPublicUrl result; student uploads store only the path.
const toStoragePath = (fileUrl: string): string => {
  const marker = "/student-documents/";
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) {
    return fileUrl.slice(idx + marker.length);
  }
  return fileUrl; // already a bare path
};

const DocumentsManager: React.FC<DocumentsManagerProps> = ({ userId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [category, setCategory] = useState("other");
  const [customDocName, setCustomDocName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const [filterCategory, setFilterCategory] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    fetchDocuments(ignore);
    return () => {
      ignore = true;
    };
  }, [userId]);

  const fetchDocuments = async (ignore = false) => {
    try {
      const { data, error } = await (supabase as any)
        .from("documents")
        .select("*")
        .eq("student_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (ignore) return;
      setDocuments(data || []);
      setLoadError(null);
    } catch (error: any) {
      if (ignore) return;
      setLoadError(error.message);
      toast({ variant: "destructive", title: t("documents.loadError"), description: error.message });
    } finally {
      if (!ignore) setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ variant: "destructive", title: t("common.error"), description: t("documents.selectFile") });
      return;
    }
    const uploadError = validateUploadFile(selectedFile);
    if (uploadError) {
      const isSizeError = /MB limit/.test(uploadError);
      toast({
        variant: "destructive",
        title: isSizeError ? t("documents.fileTooLarge", "File is too large") : t("documents.invalidType", "Unsupported file type"),
        description: uploadError,
      });
      return;
    }
    if (category === "other" && !customDocName.trim()) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("documents.customNameRequired", { defaultValue: "Please enter a document name" }),
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("student-documents").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const displayName = category === "other" && customDocName.trim() ? customDocName.trim() : selectedFile.name;
      const { error: dbError } = await (supabase as any).from("documents").insert({
        student_id: userId,
        file_name: displayName,
        file_url: filePath,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        category,
        expiry_date: expiryDate || null,
        notes: notes || null,
      });
      if (dbError) throw dbError;
      toast({ title: t("documents.uploadSuccess"), description: t("documents.uploadSuccessDesc") });
      setShowUploadModal(false);
      setSelectedFile(null);
      setCategory("other");
      setCustomDocName("");
      setExpiryDate("");
      setNotes("");
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: "destructive", title: t("documents.uploadError"), description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const logUserActivity = async (action: string, docName: string) => {
    try {
      const { error } = await (supabase as any).rpc("log_user_activity", {
        p_action: `document_${action}`,
        p_target_id: userId,
        p_target_table: "documents",
        p_details: `${action} document: ${docName}`,
      });
      if (error) throw error;
    } catch (err) {
      // Auditing must never break the document flow, but it must be visible.
      console.warn("[DocumentsManager] activity log failed:", err);
    }
  };

  // FIX: Unified download handler that works for both admin-uploaded docs
  // (file_url = full public URL) and student-uploaded docs (file_url = bare path).
  // Always uses a signed URL so the private bucket is never hit directly.
  const handleDownload = async (doc: Document) => {
    try {
      logDocumentAccess(doc.id, "download");
      const storagePath = toStoragePath(doc.file_url);
      const { data: signedData, error } = await supabase.storage
        .from("student-documents")
        .createSignedUrl(storagePath, 60);
      if (error) throw error;

      // Fetch as blob so browser downloads instead of opening in a new tab
      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();

      void logUserActivity("download", doc.file_name);

      const blobUrl = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = blobUrl;
      a.download = doc.file_name;
      a.style.display = "none";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      toast({ variant: "destructive", title: t("documents.downloadError"), description: error.message });
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(t("documents.deleteConfirm"))) return;
    try {
      const storagePath = toStoragePath(doc.file_url);
      const { error: storageError } = await supabase.storage.from("student-documents").remove([storagePath]);
      // An orphaned object must not block the row deletion, but it must be traceable.
      if (storageError) console.warn("[DocumentsManager] storage delete failed:", storageError);
      const { error } = await (supabase as any).from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      toast({ title: t("documents.deleteSuccess"), description: t("documents.deleteSuccessDesc") });
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: "destructive", title: t("documents.deleteError"), description: error.message });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t("documents.unknownSize");
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} ${t("documents.mb")}`;
  };

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const diffDays = (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (date?: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const filteredDocuments = useMemo(
    () =>
      documents.filter((doc) => {
        const matchesSearch =
          !debouncedSearch ||
          doc.file_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          doc.notes?.toLowerCase().includes(debouncedSearch.toLowerCase());
        const matchesCategory = filterCategory === "all" || doc.category === filterCategory;
        return matchesSearch && matchesCategory;
      }),
    [documents, debouncedSearch, filterCategory],
  );

  const pagination = usePagination(filteredDocuments, 25);

  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  if (isLoading) return <LoadingState variant="cards" rows={4} label={t("documents.loading")} />;

  if (loadError && documents.length === 0) {
    return (
      <ErrorState
        title={t("documents.loadError")}
        description={loadError}
        onRetry={() => {
          setIsLoading(true);
          fetchDocuments();
        }}
        retryLabel={t("common.retry", "Retry")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {(documents.filter((d) => isExpiringSoon(d.expiry_date)).length > 0 ||
        documents.filter((d) => isExpired(d.expiry_date)).length > 0) && (
        <Card className={`border ${toneClasses("payment").tint} border-[hsl(var(--status-payment)/0.3)]`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-5 w-5 ${toneClasses("payment").text}`} />
              <h3 className={`font-semibold ${toneClasses("payment").text}`}>{t("documents.alerts")}</h3>
            </div>
            {documents
              .filter((d) => isExpired(d.expiry_date))
              .map((d) => (
                <p key={d.id} className={`text-sm ${toneClasses("danger").text}`}>
                  ⚠️ {d.file_name} - {t("documents.expired")}
                </p>
              ))}
            {documents
              .filter((d) => isExpiringSoon(d.expiry_date))
              .map((d) => (
                <p key={d.id} className={`text-sm ${toneClasses("payment").text}`}>
                  ⏰ {d.file_name} -{" "}
                  {t("documents.expiringSoon", { date: new Date(d.expiry_date!).toLocaleDateString(locale) })}
                </p>
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl">{t("documents.title")}</CardTitle>
          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t("documents.upload")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("documents.uploadNew")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("documents.file")}</Label>
                  <Input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("documents.fileHint")} — {t("documents.maxSize", { defaultValue: "Max 15 MB" })}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("documents.category")}</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => {
                      setCategory(v);
                      if (v !== "other") setCustomDocName("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_KEYS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`documents.categories.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {category === "other" && (
                  <div className="space-y-2">
                    <Label>{t("documents.customDocName", { defaultValue: "Document Name *" })}</Label>
                    <Input
                      value={customDocName}
                      onChange={(e) => setCustomDocName(e.target.value)}
                      placeholder={t("documents.customDocNamePlaceholder", {
                        defaultValue: "e.g. Birth Certificate, Bank Letter...",
                      })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("documents.expiryDate")}</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("documents.notes")}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("documents.optionalNotes")}
                    rows={2}
                  />
                </div>
                <Button type="submit" disabled={isUploading} className="w-full">
                  {isUploading ? t("documents.uploading") : t("documents.uploadBtn")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("documents.searchPlaceholder")}
                className="pr-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("documents.allCategories")}</SelectItem>
                {CATEGORY_KEYS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`documents.categories.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredDocuments.length === 0 ? (
            <EmptyState
              icon={File}
              title={documents.length === 0 ? t("documents.noDocuments") : t("documents.noResults")}
            />
          ) : (
            <>
              <div className="space-y-3">
                {pagination.items.map((doc) => {
                  const expired = isExpired(doc.expiry_date);
                  const expiringSoon = isExpiringSoon(doc.expiry_date);
                  const tone = expired ? toneClasses("danger") : expiringSoon ? toneClasses("payment") : null;
                  return (
                    <Card
                      key={doc.id}
                      className={`border transition-colors ${tone ? `${tone.tint} border-[hsl(var(--status-${expired ? "danger" : "payment"})/0.3)]` : "border-border"}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                              <File className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium truncate">{doc.file_name}</h3>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {t(`documents.categories.${doc.category}`, doc.category)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                                {doc.expiry_date && (
                                  <span
                                    className={`text-xs ${expired ? `${toneClasses("danger").text} font-bold` : expiringSoon ? toneClasses("payment").text : "text-muted-foreground"}`}
                                  >
                                    {expired
                                      ? t("documents.expiredLabel")
                                      : t("documents.expiresLabel", {
                                          date: new Date(doc.expiry_date).toLocaleDateString(locale),
                                        })}
                                  </span>
                                )}
                              </div>
                              {doc.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{doc.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px]" onClick={() => handleDownload(doc)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" className="min-h-[44px] min-w-[44px]" onClick={() => handleDelete(doc)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <TablePagination pagination={pagination} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsManager;
