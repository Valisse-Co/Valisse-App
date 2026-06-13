import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft, User, Link2, LogOut, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

export default function SettingsAccount() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [showDeactivate, setShowDeactivate] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      navigate("/login");
    },
  });

  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Display name updated");
      setEditingName(false);
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deactivate = trpc.settings.deactivateAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deactivated. You have been signed out.");
      logout();
      navigate("/login");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    updateProfile.mutate({ name: nameInput.trim() });
  };

  // Determine connected account provider from openId prefix
  const openId = (user as any)?.openId ?? "";
  const provider = openId.startsWith("google") ? "Google" : openId.startsWith("apple") ? "Apple" : "Manus";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Account & Security</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Display name */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</p>
          </div>
          <div className="p-4">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={updateProfile.isPending}
                  className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameInput(user?.name ?? ""); }}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Shown on your profile and bookings</p>
                </div>
                <button
                  onClick={() => setEditingName(true)}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connected account */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connected Account</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Link2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Signed in with {provider}</p>
              <p className="text-xs text-muted-foreground truncate">{(user as any)?.email ?? openId}</p>
            </div>
          </div>
          <Separator className="ml-[68px]" />
          <button
            onClick={() => toast.info("To change your connected account, sign out and sign in with a different account.")}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Link2 size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Change Connected Account</p>
              <p className="text-xs text-muted-foreground">Sign out then sign in with a different account</p>
            </div>
          </button>
        </div>

        {/* Sign out */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <LogOut size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {logoutMutation.isPending ? "Signing out…" : "Sign Out"}
              </p>
              <p className="text-xs text-muted-foreground">You'll need to sign in again to access your account</p>
            </div>
          </button>
        </div>

        {/* Danger zone */}
        <div className="bg-card border border-destructive/30 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-destructive/20">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Danger Zone</p>
          </div>
          <button
            onClick={() => setShowDeactivate(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Trash2 size={18} className="text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Deactivate Account</p>
              <p className="text-xs text-muted-foreground">Your profile will be hidden. You can reactivate by signing back in.</p>
            </div>
          </button>
        </div>
      </div>

      {/* Deactivate confirmation */}
      <AlertDialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile will be hidden from Discover and you won't receive new bookings. Your data is preserved — sign back in at any time to reactivate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deactivate.mutate()}
            >
              {deactivate.isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
