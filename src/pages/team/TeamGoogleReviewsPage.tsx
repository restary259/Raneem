import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  MessageSquareReply,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/google/StarRating";
import { useToast } from "@/hooks/use-toast";
import {
  getOfficeGoogleReview,
  getOfficeGoogleReviewSummary,
  listMyGoogleOffices,
  listOfficeGoogleReviews,
} from "@/lib/googleBusinessApi";
import {
  deleteGoogleReviewReply,
  publishGoogleReviewReply,
  syncGoogleReviews,
} from "@/lib/googleBusinessReviews.functions";
import { useServerFn } from "@tanstack/react-start";
import { subscribeTables } from "@/lib/realtimeRegistry";
import { useSearchParams } from "@/lib/router-compat";
import {
  GBP_REPLY_MAX_BYTES,
  replyByteLength,
} from "@/lib/googleBusinessGateway";
import type {
  GoogleBusinessReviewListRow,
  GoogleReviewFilter,
  GoogleReviewSort,
  MyGoogleOfficeRow,
  OfficeGoogleReviewDetailRow,
  OfficeGoogleReviewSummaryRow,
} from "@/types/googleBusiness";

const PAGE_SIZE = 20;

const RATING_FILTERS: {
  key: string;
  rating: number | null;
  labelKey: string;
}[] = [
  { key: "all", rating: null, labelKey: "googleReviews.all" },
  { key: "unanswered", rating: null, labelKey: "googleReviews.unanswered" },
  { key: "r1", rating: 1, labelKey: "googleReviews.stars1" },
  { key: "r2", rating: 2, labelKey: "googleReviews.stars2" },
  { key: "r3", rating: 3, labelKey: "googleReviews.stars3" },
  { key: "r4", rating: 4, labelKey: "googleReviews.stars4" },
  { key: "r5", rating: 5, labelKey: "googleReviews.stars5" },
];

function relativeTime(value: string | null, t: TFunction<"dashboard">): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("notifications.hoursAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t("notifications.daysAgo", { count: days });
  return new Date(value).toLocaleDateString();
}

/**
 * The Google Reviews center (Phase 5).
 *
 * Master-detail: a filtered, paginated list on the left and an inline reply
 * composer / detail panel. All filtering and pagination happen server-side, so
 * the page stays fast with 10 reviews or 10,000. Replies are only marked
 * replied after Google confirms — see googleBusinessReviews.functions.ts.
 */
export default function TeamGoogleReviewsPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [offices, setOffices] = useState<MyGoogleOfficeRow[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [summary, setSummary] = useState<OfficeGoogleReviewSummaryRow | null>(
    null,
  );
  const [reviews, setReviews] = useState<GoogleBusinessReviewListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<GoogleReviewSort>("recent");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newReviewsAvailable, setNewReviewsAvailable] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyTarget, setReplyTarget] =
    useState<GoogleBusinessReviewListRow | null>(null);
  const [confirmDelete, setConfirmDelete] =
    useState<GoogleBusinessReviewListRow | null>(null);

  const runSync = useServerFn(syncGoogleReviews);
  const runPublish = useServerFn(publishGoogleReviewReply);
  const runDelete = useServerFn(deleteGoogleReviewReply);

  // Debounce the search box so we do not query on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadOffices = useCallback(async () => {
    const { data, error } = await listMyGoogleOffices();
    if (error) {
      toast({ variant: "destructive", description: error.message });
      return;
    }
    const list = data || [];
    setOffices(list);
    setOfficeId((current) => current ?? list[0]?.office_id ?? null);
  }, [toast]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  const activeFilter =
    RATING_FILTERS.find((f) => f.key === filter) ?? RATING_FILTERS[0];
  const statusFilter: GoogleReviewFilter =
    activeFilter.key === "unanswered" ? "unanswered" : "all";

  const load = useCallback(async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        getOfficeGoogleReviewSummary(officeId),
        listOfficeGoogleReviews({
          officeId,
          limit: PAGE_SIZE,
          offset,
          rating: activeFilter.rating,
          status: statusFilter,
          search,
          sort,
        }),
      ]);
      if (summaryRes.error) throw summaryRes.error;
      if (listRes.error) throw listRes.error;
      setSummary((summaryRes.data || [])[0] || null);
      const rows = listRes.data || [];
      setReviews(rows);
      setTotal(rows[0]?.total_count ?? 0);
    } catch (error) {
      toast({
        variant: "destructive",
        description: (error as { message?: string })?.message,
      });
    } finally {
      setLoading(false);
    }
  }, [
    officeId,
    offset,
    activeFilter.rating,
    statusFilter,
    search,
    sort,
    toast,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // A NEW_REVIEW event lands in `google_business_reviews`; nudge the operator
  // instead of silently changing the list under them. Our own reply/sync
  // writes also touch the table, so they are suppressed briefly.
  const suppressRealtimeUntil = useRef(0);
  useEffect(() => {
    return subscribeTables(
      "google-business-reviews",
      ["google_business_reviews"],
      () => {
        if (Date.now() < suppressRealtimeUntil.current) return;
        setNewReviewsAvailable(true);
      },
    );
  }, []);

  // Our own writes should not raise the "new review" banner.
  const refresh = useCallback(async () => {
    suppressRealtimeUntil.current = Date.now() + 2000;
    setNewReviewsAvailable(false);
    await load();
  }, [load]);

  // Reset to page 1 whenever the query changes.
  useEffect(() => {
    setOffset(0);
  }, [officeId, filter, search, sort]);

  const selected = useMemo(
    () => reviews.find((r) => r.id === selectedId) ?? null,
    [reviews, selectedId],
  );

  // A notification deep-links to one review (`?review=<id>`). The id may live
  // outside the current page/filter, so fetch it directly and select it; the
  // RPC re-checks office authorization, so an id from another office yields
  // nothing rather than leaking a review.
  const deepLinkId = searchParams.get("review");
  useEffect(() => {
    if (!deepLinkId || !officeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await getOfficeGoogleReview(officeId, deepLinkId);
      if (cancelled) return;
      const row: OfficeGoogleReviewDetailRow | undefined = data?.[0];
      if (!row) return;
      setReviews((prev) =>
        prev.some((r) => r.id === row.id) ? prev : [row, ...prev],
      );
      setSelectedId(row.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [deepLinkId, officeId]);

  const draftBytes = replyByteLength(replyDraft);
  const draftValid =
    replyDraft.trim().length > 0 && draftBytes <= GBP_REPLY_MAX_BYTES;

  function openComposer(review: GoogleBusinessReviewListRow) {
    setReplyTarget(review);
    setReplyDraft(review.reply_comment ?? "");
    setSelectedId(review.id);
  }

  async function handleSync() {
    if (!officeId || busy) return;
    setBusy(true);
    try {
      const result = await runSync({ data: { officeId } });
      if (result.status === "synced") {
        toast({
          description: t("googleReviews.syncedNow", {
            inserted: result.inserted,
            updated: result.updated,
          }),
        });
        await refresh();
      } else if (result.status === "locked") {
        toast({ description: t("googleReviews.syncInProgress") });
      } else {
        toast({
          variant: "destructive",
          description: result.errorMessage || t("googleReviews.syncFailed"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          (error as { message?: string })?.message ||
          t("googleReviews.syncFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!officeId || !replyTarget || busy || !draftValid) return;
    setBusy(true);
    try {
      const result = await runPublish({
        data: { officeId, reviewId: replyTarget.id, comment: replyDraft },
      });
      if (result.ok) {
        if (result.status === "rejected") {
          toast({
            variant: "destructive",
            description: t("googleReviews.replyRejectedHint"),
          });
        } else if (result.status === "pending") {
          toast({ description: t("googleReviews.replyPendingHint") });
        } else {
          toast({ description: t("googleReviews.replySubmitted") });
        }
        setReplyTarget(null);
        setReplyDraft("");
        await refresh();
      } else {
        // Keep the draft so the operator never loses their text.
        toast({
          variant: "destructive",
          description:
            result.errorMessage ||
            (result.status === "uncertain"
              ? t("googleReviews.replyUncertain")
              : t("googleReviews.replyFailed")),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!officeId || !confirmDelete || busy) return;
    setBusy(true);
    try {
      const result = await runDelete({
        data: { officeId, reviewId: confirmDelete.id },
      });
      if (result.ok) {
        toast({ description: t("googleReviews.replyDeleted") });
        setConfirmDelete(null);
        await refresh();
      } else {
        toast({
          variant: "destructive",
          description: result.errorMessage || t("googleReviews.replyFailed"),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!loading && offices.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-2 py-10 text-center">
            <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {t("googleReviews.noOfficeTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("googleReviews.noOfficeDesc")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unverified = summary?.verification_status !== "verified";
  const connectionBroken =
    summary?.connection_status === "error" ||
    summary?.mapping_status === "MAPPING_ERROR";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Star className="size-5 text-amber-400" />
            {t("googleReviews.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("googleReviews.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {offices.length > 1 && (
            <Select value={officeId ?? undefined} onValueChange={setOfficeId}>
              <SelectTrigger className="w-[190px]">
                <Building2 className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o.office_id} value={o.office_id}>
                    {o.office_name || t("googleReviews.officeFallback")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={busy || !officeId}
            title={t("googleReviews.syncNow")}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span className="hidden sm:inline">
              {summary?.review_last_synced_at
                ? t("googleReviews.lastSynced", {
                    time: relativeTime(summary.review_last_synced_at, t),
                  })
                : t("googleReviews.syncNow")}
            </span>
          </Button>
        </div>
      </header>

      {connectionBroken && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-destructive" />
          <div>
            <p className="font-medium">{t("googleReviews.connectionError")}</p>
            <p className="text-muted-foreground">
              {t("googleReviews.connectionErrorHint")}
            </p>
          </div>
        </div>
      )}
      {!connectionBroken && unverified && summary && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-amber-500" />
          <p className="text-muted-foreground">
            {t("googleReviews.notVerified")}
          </p>
        </div>
      )}

      {newReviewsAvailable && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <span className="flex items-center gap-2">
            <Star className="size-4 text-amber-400" />
            {t("googleReviews.newReviewBanner")}
          </span>
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            {t("googleReviews.viewNewReview")}
          </Button>
        </div>
      )}

      <SummaryHeader summary={summary} t={t} />

      <div className="flex flex-wrap items-center gap-2">
        {RATING_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            className="rounded-full"
          >
            {f.rating ? (
              <span className="flex items-center gap-1">
                {f.rating}
                <Star className="size-3.5 fill-current" />
              </span>
            ) : (
              t(f.labelKey)
            )}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("googleReviews.search")}
            className="ps-9"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as GoogleReviewSort)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">
              {t("googleReviews.sortRecent")}
            </SelectItem>
            <SelectItem value="oldest">
              {t("googleReviews.sortOldest")}
            </SelectItem>
            <SelectItem value="rating_desc">
              {t("googleReviews.sortRatingDesc")}
            </SelectItem>
            <SelectItem value="rating_asc">
              {t("googleReviews.sortRatingAsc")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-3">
          {loading ? (
            <ReviewSkeletons />
          ) : reviews.length === 0 ? (
            <EmptyState filter={filter} searching={Boolean(search)} t={t} />
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                t={t}
                selected={selectedId === review.id}
                onOpen={() => setSelectedId(review.id)}
                onReply={() => openComposer(review)}
              />
            ))
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
              <span>
                {t("googleReviews.pageOf", {
                  from: offset + 1,
                  to: Math.min(offset + PAGE_SIZE, total),
                  total,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  {t("googleReviews.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  {t("googleReviews.next")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <ReviewDetailPanel
            review={selected}
            t={t}
            replyDraft={replyDraft}
            setReplyDraft={setReplyDraft}
            draftBytes={draftBytes}
            draftValid={draftValid}
            busy={busy}
            editing={Boolean(replyTarget && replyTarget.id === selected?.id)}
            onReply={() => selected && openComposer(selected)}
            onCancelReply={() => {
              setReplyTarget(null);
              setReplyDraft("");
            }}
            onPublish={handlePublish}
            onDelete={() => selected && setConfirmDelete(selected)}
          />
        </aside>
      </div>

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("googleReviews.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("googleReviews.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {t("googleReviews.deleteReply")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryHeader({
  summary,
  t,
}: {
  summary: OfficeGoogleReviewSummaryRow | null;
  t: TFunction<"dashboard">;
}) {
  if (!summary) return null;
  const average = summary.average_rating ?? 0;
  const total = summary.total_count ?? 0;
  const max = Math.max(
    summary.rating_1,
    summary.rating_2,
    summary.rating_3,
    summary.rating_4,
    summary.rating_5,
    1,
  );
  const bars: { stars: number; count: number }[] = [
    { stars: 5, count: summary.rating_5 },
    { stars: 4, count: summary.rating_4 },
    { stars: 3, count: summary.rating_3 },
    { stars: 2, count: summary.rating_2 },
    { stars: 1, count: summary.rating_1 },
  ];
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-6 py-5">
        <div className="text-center">
          <div className="text-3xl font-semibold">{average.toFixed(1)}</div>
          <StarRating rating={Math.round(average)} className="mt-1" />
          <div className="mt-1 text-xs text-muted-foreground">
            {t("googleReviews.totalReviews", { count: total })}
          </div>
        </div>
        <div className="min-w-[220px] flex-1 space-y-1">
          {bars.map((bar) => (
            <div key={bar.stars} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-end text-muted-foreground">
                {bar.stars}★
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.round((bar.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-8 text-end text-muted-foreground">
                {bar.count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewCard({
  review,
  t,
  selected,
  onOpen,
  onReply,
}: {
  review: GoogleBusinessReviewListRow;
  t: TFunction<"dashboard">;
  selected: boolean;
  onOpen: () => void;
  onReply: () => void;
}) {
  const name =
    review.reviewer_is_anonymous || !review.reviewer_display_name
      ? t("googleReviews.anonymous")
      : review.reviewer_display_name;
  const replied = review.darb_reply_status === "ANSWERED";
  return (
    <Card
      className={`cursor-pointer rounded-2xl border-border shadow-sm transition-colors ${
        selected ? "border-primary/60 bg-primary/5" : "hover:border-primary/30"
      }`}
      onClick={onOpen}
    >
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StarRating rating={review.star_rating} />
            <p className="mt-1 truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {relativeTime(review.review_update_time, t)}
            </p>
          </div>
          <ReplyStatusBadge review={review} t={t} />
        </div>
        {review.comment && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {review.comment}
          </p>
        )}
        {review.reply_comment && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("googleReviews.yourResponse")}
            </p>
            <p className="mt-1 line-clamp-2 text-sm">{review.reply_comment}</p>
          </div>
        )}
        {!replied && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onReply();
            }}
          >
            <MessageSquareReply className="size-4" />
            {t("googleReviews.reply")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ReplyStatusBadge({
  review,
  t,
}: {
  review: GoogleBusinessReviewListRow;
  t: TFunction<"dashboard">;
}) {
  if (review.darb_reply_status === "ANSWERED") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="size-3" />
        {t("googleReviews.replied")}
      </Badge>
    );
  }
  if (review.darb_reply_status === "REPLY_PENDING") {
    return (
      <Badge variant="outline" className="gap-1 text-amber-600">
        <Clock3 className="size-3" />
        {t("googleReviews.pending")}
      </Badge>
    );
  }
  if (review.darb_reply_status === "REPLY_REJECTED") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        {t("googleReviews.rejected")}
      </Badge>
    );
  }
  return null;
}

function ReviewDetailPanel({
  review,
  t,
  replyDraft,
  setReplyDraft,
  draftBytes,
  draftValid,
  busy,
  editing,
  onReply,
  onCancelReply,
  onPublish,
  onDelete,
}: {
  review: GoogleBusinessReviewListRow | null;
  t: TFunction<"dashboard">;
  replyDraft: string;
  setReplyDraft: (v: string) => void;
  draftBytes: number;
  draftValid: boolean;
  busy: boolean;
  editing: boolean;
  onReply: () => void;
  onCancelReply: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  if (!review) {
    return (
      <Card className="rounded-2xl border-dashed border-border shadow-none">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("googleReviews.selectReview")}
        </CardContent>
      </Card>
    );
  }
  const name =
    review.reviewer_is_anonymous || !review.reviewer_display_name
      ? t("googleReviews.anonymous")
      : review.reviewer_display_name;
  return (
    <Card className="sticky top-4 rounded-2xl border-border shadow-sm">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{name}</p>
            <StarRating rating={review.star_rating} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              {relativeTime(review.review_update_time, t)}
            </p>
          </div>
          {review.google_review_url && (
            <Button asChild size="sm" variant="ghost">
              <a
                href={review.google_review_url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-4" />
                {t("googleReviews.openInGoogle")}
              </a>
            </Button>
          )}
        </div>

        {review.comment && (
          <p className="whitespace-pre-wrap text-sm">{review.comment}</p>
        )}

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {t("googleReviews.yourResponse")}
            </p>
            <ReplyStatusBadge review={review} t={t} />
          </div>

          {review.darb_reply_status === "REPLY_REJECTED" && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs">
              <ShieldAlert className="mt-0.5 size-3.5 text-destructive" />
              <span>{t("googleReviews.rejectedHint")}</span>
            </div>
          )}

          {editing || !review.reply_comment ? (
            editing ? (
              <div className="space-y-2">
                <Textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  rows={5}
                  placeholder={t("googleReviews.replyPlaceholder")}
                  className="resize-none"
                />
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      draftBytes > GBP_REPLY_MAX_BYTES
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {draftBytes} / {GBP_REPLY_MAX_BYTES}{" "}
                    {t("googleReviews.bytes")}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCancelReply}
                    disabled={busy}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={onPublish}
                    disabled={busy || !draftValid}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageSquareReply className="size-4" />
                    )}
                    {t("googleReviews.publish")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={onReply}>
                <MessageSquareReply className="size-4" />
                {t("googleReviews.reply")}
              </Button>
            )
          ) : (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">
                {review.reply_comment}
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={onReply}>
                  {t("googleReviews.editReply")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete}>
                  <Trash2 className="size-4" />
                  {t("googleReviews.deleteReply")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewSkeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-3 py-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function EmptyState({
  filter,
  searching,
  t,
}: {
  filter: string;
  searching: boolean;
  t: TFunction<"dashboard">;
}) {
  const title = searching
    ? t("googleReviews.noResults")
    : filter === "unanswered"
      ? t("googleReviews.noUnanswered")
      : t("googleReviews.noReviews");
  const desc = searching
    ? null
    : filter === "unanswered"
      ? t("googleReviews.noUnansweredDesc")
      : t("googleReviews.noReviewsDesc");
  return (
    <Card className="rounded-2xl border-dashed border-border shadow-none">
      <CardContent className="space-y-1 py-10 text-center">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </CardContent>
    </Card>
  );
}
