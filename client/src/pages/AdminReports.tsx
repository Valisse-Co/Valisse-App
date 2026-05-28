import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Flag, EyeOff, Trash2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function AdminReports() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "dismissed">("pending");

  const { data: reports = [], isLoading, refetch } = trpc.reports.list.useQuery(undefined, {
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
    </div>
  );
}
