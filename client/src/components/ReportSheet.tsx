import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Flag, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const REASONS = [
  { value: "nudity", label: "Nudity / Sexual content" },
  { value: "stolen_content", label: "Stolen content / Copyright" },
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or hate speech" },
  { value: "violence", label: "Violence or dangerous content" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

interface ReportSheetProps {
  postId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportSheet({ postId, open, onOpenChange }: ReportSheetProps) {
  const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: hasReportedData } = trpc.reports.hasReported.useQuery(
    { postId },
    { enabled: open }
  );

  const submitMutation = trpc.reports.submit.useMutation({
    onSuccess: (data) => {
      if (data.alreadyReported) {
        toast.info("You've already reported this post.");
        onOpenChange(false);
        return;
      }
      setSubmitted(true);
    },
    onError: () => {
      toast.error("Failed to submit report. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!selectedReason) return;
    if (selectedReason === "other" && !note.trim()) return;
    submitMutation.mutate({ postId, reason: selectedReason, note: note.trim() || undefined });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setSelectedReason(null);
      setNote("");
      setSubmitted(false);
    }, 300);
  };

  const alreadyReported = hasReportedData?.reported;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Flag size={16} className="text-red-500" />
            Report Post
          </SheetTitle>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <CheckCircle2 size={40} className="text-green-500" />
            <p className="font-semibold text-foreground">Report submitted</p>
            <p className="text-sm text-muted-foreground">
              Thank you — our team will review this post.
            </p>
            <Button variant="outline" className="mt-2" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : alreadyReported ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <CheckCircle2 size={40} className="text-muted-foreground" />
            <p className="font-semibold text-foreground">Already reported</p>
            <p className="text-sm text-muted-foreground">
              You've already submitted a report for this post.
            </p>
            <Button variant="outline" className="mt-2" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2 pb-6">
            <p className="text-sm text-muted-foreground">
              Why are you reporting this post?
            </p>

            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSelectedReason(r.value)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                    selectedReason === r.value
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                      : "border-border bg-card text-foreground hover:border-muted-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Note field — required for Other, optional for all */}
            {selectedReason && (
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-xs text-muted-foreground font-medium">
                  {selectedReason === "other"
                    ? "Please describe the issue (required)"
                    : "Additional details (optional)"}
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add more context..."
                  rows={3}
                  maxLength={500}
                  className="resize-none text-sm"
                />
                <span className="text-xs text-muted-foreground text-right">
                  {note.length}/500
                </span>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={
                !selectedReason ||
                (selectedReason === "other" && !note.trim()) ||
                submitMutation.isPending
              }
              variant="destructive"
              className="mt-1"
            >
              {submitMutation.isPending ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
