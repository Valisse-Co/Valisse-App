import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Flag, EyeOff, Trash2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Landmark, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const REASON_LABELS: Record<string, string> = {
  nudity: "Nudity / Sexual content",
  stolen_content: "Stolen content / Copyright",
  spam: "Spam or misleading",
  harassment: "Harassment or hate speech",
  violence: "Violence or dangerous content",
  other: "Other",
};

const REASON_COLORS: Record<string, string> = {
  nudity: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  stolen_content: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  spam: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  harassment: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  violence: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  other: "bg-muted text-muted-foreground",
};

function IssueResolutionDialog({ booking, onClose, onResolved }: { booking: any; onClose: () => void; onResolved: () => void }) {
  const total = booking.serviceTotalInCents ?? 0;
  const hasTip = booking.tipStatus === "paid" && booking.tipAmountInCents > 0;
  const [action, setAction] = useState<"release_payout" | "refund_client">("release_payout");
  const [refundAmount, setRefundAmount] = useState((total / 100).toFixed(2));
  const [refundTip, setRefundTip] = useState(hasTip);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const resolve = trpc.appointment.resolveIssue.useMutation({
    onSuccess: (result) => {
      toast.success(result.resolution === "payout_released" ? "Payout released after administrator review." : result.resolution === "full_refund" ? "Full client refund issued and the payout hold was resolved." : "Partial client refund issued and the remaining payout was released.");
      onResolved();
      onClose();
    },
    onError: (error) => toast.error(error.message || "Could not resolve this appointment issue."),
  });
  const refundAmountInCents = Math.round(Number(refundAmount) * 100);
  const validRefund = Number.isFinite(refundAmountInCents) && refundAmountInCents >= 1 && refundAmountInCents <= total;
  const fullRefund = validRefund && refundAmountInCents === total;
  const willRefundTip = hasTip && (refundTip || fullRefund);

  const submit = () => resolve.mutate({
    bookingId: booking.id,
    action,
    ...(action === "refund_client" ? { refundAmountInCents } : {}),
    refundTip: action === "refund_client" && willRefundTip,
    resolutionNote: note.trim(),
  });

  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Resolve appointment issue</DialogTitle></DialogHeader>{!reviewing ? <div className="space-y-4"><div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3"><p className="text-xs font-semibold text-foreground">Booking #{booking.id} · ${((total ?? 0) / 100).toFixed(2)} service total</p><p className="mt-1 text-xs text-muted-foreground">Record this decision only after speaking with the client and nail tech. The current payout remains on hold until you confirm a resolution.</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => { setAction("release_payout"); setReviewing(false); }} className={`rounded-xl border p-3 text-left ${action === "release_payout" ? "border-primary bg-primary/5" : "border-border"}`}><Landmark className="text-primary" size={18} /><p className="mt-2 text-xs font-semibold text-foreground">Release payout</p><p className="mt-1 text-[11px] text-muted-foreground">No client refund. Send the service payout and any paid tip to the tech.</p></button><button onClick={() => { setAction("refund_client"); setReviewing(false); }} className={`rounded-xl border p-3 text-left ${action === "refund_client" ? "border-destructive bg-destructive/5" : "border-border"}`}><RotateCcw className="text-destructive" size={18} /><p className="mt-2 text-xs font-semibold text-foreground">Refund client</p><p className="mt-1 text-[11px] text-muted-foreground">Issue a full or partial service refund, then release any remaining payout.</p></button></div>{action === "refund_client" && <div className="space-y-3 rounded-xl border border-border p-3"><div><label className="text-xs font-semibold text-foreground">Service refund amount</label><div className="relative mt-1"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span><Input className="pl-7" type="number" inputMode="decimal" min="0.01" max={(total / 100).toFixed(2)} step="0.01" value={refundAmount} onChange={(event) => { setRefundAmount(event.target.value); setReviewing(false); }} /></div><p className="mt-1 text-[11px] text-muted-foreground">Maximum available service refund: ${(total / 100).toFixed(2)}. A full refund prevents a service payout.</p></div>{hasTip && <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs"><input type="checkbox" checked={refundTip || fullRefund} disabled={fullRefund} onChange={(event) => { setRefundTip(event.target.checked); setReviewing(false); }} className="mt-0.5" /><span><span className="font-semibold text-foreground">Refund the ${((booking.tipAmountInCents ?? 0) / 100).toFixed(2)} tip</span><span className="mt-0.5 block text-muted-foreground">A full service refund always returns the tip to the client.</span></span></label>}</div>}<div><label className="text-xs font-semibold text-foreground">Administrator resolution note</label><Textarea className="mt-1 min-h-24" value={note} onChange={(event) => { setNote(event.target.value); setReviewing(false); }} placeholder="Summarize the contact with both parties and the decision." /><p className="mt-1 text-[11px] text-muted-foreground">At least 10 characters. This stays with the booking’s internal resolution record.</p></div><Button className="w-full" disabled={note.trim().length < 10 || (action === "refund_client" && !validRefund)} onClick={() => setReviewing(true)}>Review resolution</Button></div> : <div className="space-y-4"><div className="rounded-xl border border-amber-300 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Confirm financial resolution</p>{action === "release_payout" ? <p className="mt-1 text-xs leading-relaxed text-amber-800">This sends the nail tech’s service payout of ${(total * 0.95 / 100).toFixed(2)} after the 5% Valisse fee{hasTip ? `, plus the $${((booking.tipAmountInCents ?? 0) / 100).toFixed(2)} tip` : ""}. No money is refunded to the client.</p> : <p className="mt-1 text-xs leading-relaxed text-amber-800">This refunds ${((refundAmountInCents ?? 0) / 100).toFixed(2)} to the client{willRefundTip ? ` and returns their $${((booking.tipAmountInCents ?? 0) / 100).toFixed(2)} tip` : ""}.{!fullRefund && ` The remaining service payout is calculated from $${((total - refundAmountInCents) / 100).toFixed(2)}.`}</p>}<p className="mt-2 text-[11px] text-amber-800">Resolution note: {note}</p></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setReviewing(false)}>Back</Button><Button variant={action === "refund_client" ? "destructive" : "default"} disabled={resolve.isPending} onClick={submit}>{resolve.isPending ? "Processing…" : action === "release_payout" ? "Confirm & release payout" : "Confirm & issue refund"}</Button></div></div>}</DialogContent></Dialog>;
}

export default function AdminReports() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "dismissed">("pending");
  const [resolvingBooking, setResolvingBooking] = useState<any | null>(null);

  const { data: reports = [], isLoading, refetch } = trpc.reports.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: disputedBookings = [] } = trpc.appointment.disputedBookings.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const dismissMutation = trpc.reports.dismiss.useMutation({
    onSuccess: () => { toast.success("Report dismissed"); refetch(); },
    onError: () => toast.error("Failed to dismiss report"),
  });

  const hidePostMutation = trpc.reports.hidePost.useMutation({
    onSuccess: () => { toast.success("Post hidden from public feed"); refetch(); },
    onError: () => toast.error("Failed to hide post"),
  });

  const deletePostMutation = trpc.reports.deletePost.useMutation({
    onSuccess: () => { toast.success("Post deleted permanently"); refetch(); },
    onError: () => toast.error("Failed to delete post"),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Please sign in to access this page.</p>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle size={32} className="text-amber-500" />
          <p className="font-semibold text-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground">You need admin privileges to view this page.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const filtered = reports.filter((r: any) => {
    if (filter === "pending") return r.status === "pending";
    if (filter === "dismissed") return r.status === "dismissed";
    return true;
  });

  const pendingCount = reports.filter((r: any) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Flag size={20} className="text-red-500" />
          <h1 className="font-bold text-lg text-foreground">Content Reports</h1>
          {pendingCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["pending", "all", "dismissed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize",
                filter === f
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {(disputedBookings as any[]).length > 0 && <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-center gap-2"><AlertTriangle size={18} className="text-destructive" /><h2 className="font-semibold text-sm text-foreground">Appointment issues holding payout</h2></div><p className="mt-1 text-xs text-muted-foreground">Review client reports after speaking with both parties. You can release the payout or issue a full or partial service refund.</p><div className="mt-3 space-y-2">{(disputedBookings as any[]).map((booking) => <div key={booking.id} className="rounded-xl bg-background/80 p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-semibold text-foreground">Booking #{booking.id}</span><span className="text-destructive">Payout on hold</span></div><p className="mt-1 text-muted-foreground">Service total: ${((booking.serviceTotalInCents ?? 0) / 100).toFixed(2)}{booking.tipStatus === "paid" ? ` · Tip: $${((booking.tipAmountInCents ?? 0) / 100).toFixed(2)}` : ""}</p><p className="mt-1 text-muted-foreground">{booking.issueReason}</p><p className="mt-1 text-[10px] text-muted-foreground">Reported {booking.issueReportedAt ? new Date(booking.issueReportedAt).toLocaleString() : "recently"}</p><Button size="sm" className="mt-3 w-full" onClick={() => setResolvingBooking(booking)}>Review & resolve</Button></div>)}</div></section>}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CheckCircle2 size={36} className="text-green-500" />
            <p className="font-semibold text-foreground">
              {filter === "pending" ? "No pending reports" : "No reports found"}
            </p>
            <p className="text-sm text-muted-foreground">
              {filter === "pending" ? "All reports have been reviewed." : "Nothing to show here."}
            </p>
          </div>
        ) : (
          filtered.map((report: any) => {
            const isExpanded = expandedId === report.id;
            const isDismissed = report.status === "dismissed";
            const isPostHidden = report.postStatus === "hidden";
            const firstImage = (() => {
              try {
                const parsed = typeof report.postImageUrls === "string"
                  ? JSON.parse(report.postImageUrls)
                  : report.postImageUrls;
                return Array.isArray(parsed) ? parsed[0] : null;
              } catch { return null; }
            })();

            return (
              <div
                key={report.id}
                className={cn(
                  "rounded-2xl border bg-card overflow-hidden",
                  isDismissed && "opacity-60"
                )}
              >
                {/* Report summary row */}
                <button
                  className="w-full flex items-start gap-3 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  {/* Post thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    {firstImage ? (
                      <img src={firstImage} alt="post" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">💅</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          REASON_COLORS[report.reason] ?? REASON_COLORS.other
                        )}
                      >
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      {isDismissed && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          Dismissed
                        </span>
                      )}
                      {isPostHidden && (
                        <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                          Post hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Post #{report.postId} · Reported by {report.reporterName ?? `User #${report.reporterId}`}
                    </p>
                    {report.note && (
                      <p className="text-xs text-foreground/70 mt-0.5 truncate italic">"{report.note}"</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-muted-foreground">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded action area */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-muted/30 flex flex-col gap-3">
                    {/* Post caption */}
                    {report.postCaption && (
                      <p className="text-sm text-foreground/80 italic">"{report.postCaption}"</p>
                    )}

                    {/* Full note */}
                    {report.note && (
                      <div className="bg-background rounded-xl p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Reporter's note</p>
                        <p className="text-sm text-foreground">{report.note}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {!isDismissed && (
                      <div className="flex flex-col gap-2">
                        {!isPostHidden && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            onClick={() => hidePostMutation.mutate({ postId: report.postId })}
                            disabled={hidePostMutation.isPending}
                          >
                            <EyeOff size={14} />
                            Hide post from feed
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => {
                            if (confirm("Permanently delete this post? This cannot be undone.")) {
                              deletePostMutation.mutate({ postId: report.postId });
                            }
                          }}
                          disabled={deletePostMutation.isPending}
                        >
                          <Trash2 size={14} />
                          Delete post permanently
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 text-muted-foreground"
                          onClick={() => dismissMutation.mutate({ reportId: report.id })}
                          disabled={dismissMutation.isPending}
                        >
                          <CheckCircle2 size={14} />
                          Dismiss report (no action needed)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {resolvingBooking && <IssueResolutionDialog booking={resolvingBooking} onClose={() => setResolvingBooking(null)} onResolved={() => { setResolvingBooking(null); refetch(); }} />}
    </div>
  );
}
