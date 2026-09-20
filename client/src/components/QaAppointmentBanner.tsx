import { FlaskConical, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/** Visible only to the disposable client created by an active preview QA run. */
export function QaAppointmentBanner() {
  const current = trpc.qaAppointment.current.useQuery(undefined, { refetchInterval: 5_000 });
  const returnToAdmin = trpc.qaAppointment.returnToAdmin.useMutation({
    onSuccess: ({ destination }) => window.location.assign(destination),
    onError: (error) => toast.error(error.message || "Could not return to the QA Appointment Lab."),
  });

  if (!current.data?.run || current.data.canManage) return null;

  return (
    <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-2.5">
        <FlaskConical className="mt-0.5 shrink-0" size={17} />
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold">QA client session · Stripe test mode</p><p className="mt-0.5 text-xs leading-relaxed opacity-80">This is the temporary client used only for the active appointment test. Cards and payments here must use Stripe test data.</p></div>
      </div>
      <button onClick={() => returnToAdmin.mutate()} disabled={returnToAdmin.isPending} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-900/40"><RotateCcw size={13} />{returnToAdmin.isPending ? "Returning…" : "Return to QA Appointment Lab"}</button>
    </div>
  );
}
