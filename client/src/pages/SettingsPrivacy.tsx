import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft, Search, UserX, Shield, Eye, EyeOff, MapPin, MessageSquare, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type PrivacySettings = {
  profilePrivate: boolean;
  hideBookingHistory: boolean;
  hideFromNearMe: boolean;
  discoverVisible: boolean;
  hideExactAddress: boolean;
  hideApproxLocation: boolean;
  messagePermission: "anyone" | "booked_only";
};

const DEFAULT_SETTINGS: PrivacySettings = {
  profilePrivate: false,
  hideBookingHistory: false,
  hideFromNearMe: false,
  discoverVisible: true,
  hideExactAddress: false,
  hideApproxLocation: false,
  messagePermission: "anyone",
};

export default function SettingsPrivacy() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [blockSearch, setBlockSearch] = useState("");
  const [unblockTarget, setUnblockTarget] = useState<{ id: number; name: string | null } | null>(null);

  const isTech = user?.userType === "nail_tech";

  const { data: savedSettings } = trpc.settings.getPrivacySettings.useQuery();
  const { data: blockedUsers = [], refetch: refetchBlocked } = trpc.settings.getBlockedUsers.useQuery({ search: blockSearch });
  const { data: interactedUsers = [] } = trpc.settings.getInteractedUsers.useQuery();

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        profilePrivate: (savedSettings as any).profilePrivate ?? false,
        hideBookingHistory: (savedSettings as any).hideBookingHistory ?? false,
        hideFromNearMe: (savedSettings as any).hideFromNearMe ?? false,
        discoverVisible: (savedSettings as any).discoverVisible ?? true,
        hideExactAddress: (savedSettings as any).hideExactAddress ?? false,
        hideApproxLocation: (savedSettings as any).hideApproxLocation ?? false,
        messagePermission: (savedSettings as any).messagePermission ?? "anyone",
      });
    }
  }, [savedSettings]);

  const updatePrivacy = trpc.settings.updatePrivacySettings.useMutation({
    onSuccess: () => {
      toast.success("Privacy settings saved");
      setDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const blockUserMutation = trpc.settings.blockUser.useMutation({
    onSuccess: () => {
      refetchBlocked();
      toast.success("User blocked");
    },
    onError: (e) => toast.error(e.message),
  });

  const unblockUserMutation = trpc.settings.unblockUser.useMutation({
    onSuccess: () => {
      refetchBlocked();
      setUnblockTarget(null);
      toast.success("User unblocked");
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof PrivacySettings, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updatePrivacy.mutate(settings);
  };

  // Interacted users not already blocked
  const blockedIds = new Set(blockedUsers.map((u: any) => u.blockedId));
  const blockableUsers = interactedUsers.filter((u: any) => !blockedIds.has(u.id));
  const filteredBlockable = blockSearch
    ? blockableUsers.filter((u: any) => u.name?.toLowerCase().includes(blockSearch.toLowerCase()))
    : blockableUsers;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Privacy</h1>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={updatePrivacy.isPending}>
            {updatePrivacy.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Client privacy controls */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Visibility</p>
          </div>

          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Lock size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Private Profile</p>
              <p className="text-xs text-muted-foreground">Only visible to techs you've booked</p>
            </div>
            <Switch checked={settings.profilePrivate} onCheckedChange={(v) => set("profilePrivate", v)} />
          </div>

          <Separator className="ml-[68px]" />

          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <EyeOff size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Hide Booking History</p>
              <p className="text-xs text-muted-foreground">Techs won't see your past bookings</p>
            </div>
            <Switch checked={settings.hideBookingHistory} onCheckedChange={(v) => set("hideBookingHistory", v)} />
          </div>

          <Separator className="ml-[68px]" />

          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <MapPin size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Hide from "Near Me"</p>
              <p className="text-xs text-muted-foreground">Won't appear in location-based searches</p>
            </div>
            <Switch checked={settings.hideFromNearMe} onCheckedChange={(v) => set("hideFromNearMe", v)} />
          </div>
        </div>

        {/* Tech-specific controls */}
        {isTech && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tech Profile Controls</p>
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Eye size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Appear in Discover</p>
                <p className="text-xs text-muted-foreground">Turn off to go "by referral only"</p>
              </div>
              <Switch checked={settings.discoverVisible} onCheckedChange={(v) => set("discoverVisible", v)} />
            </div>

            <Separator className="ml-[68px]" />

            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <MapPin size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Hide Exact Address</p>
                <p className="text-xs text-muted-foreground">Show city only, not full address</p>
              </div>
              <Switch checked={settings.hideExactAddress} onCheckedChange={(v) => set("hideExactAddress", v)} />
            </div>

            <Separator className="ml-[68px]" />

            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <MapPin size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Hide Approximate Location</p>
                <p className="text-xs text-muted-foreground">Remove the map pin from your profile and the Near Me map</p>
              </div>
              <Switch checked={settings.hideApproxLocation} onCheckedChange={(v) => set("hideApproxLocation", v)} />
            </div>

            <Separator className="ml-[68px]" />

            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <MessageSquare size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Who Can Message You</p>
                <p className="text-xs text-muted-foreground">Control who can start a conversation</p>
              </div>
              <Select
                value={settings.messagePermission}
                onValueChange={(v) => set("messagePermission", v)}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anyone">Anyone</SelectItem>
                  <SelectItem value="booked_only">Booked only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Blocked users */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blocked Users</p>
            <p className="text-xs text-muted-foreground mt-0.5">Blocked users can't see your profile or message you</p>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users to block or manage…"
                className="pl-9 h-9 text-sm"
                value={blockSearch}
                onChange={(e) => setBlockSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Currently blocked */}
          {blockedUsers.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">Blocked</p>
              {blockedUsers.map((entry: any) => (
                <div key={entry.blockedId} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={entry.blockedUser?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {entry.blockedUser?.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.blockedUser?.name ?? "Unknown"}</p>
                  </div>
                  <button
                    onClick={() => setUnblockTarget({ id: entry.blockedId, name: entry.blockedUser?.name ?? null })}
                    className="text-xs text-primary font-medium hover:text-primary/80 transition"
                  >
                    Unblock
                  </button>
                </div>
              ))}
              {filteredBlockable.length > 0 && <Separator className="my-2" />}
            </div>
          )}

          {/* Blockable users (recent interactions) */}
          {filteredBlockable.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">Recent Interactions</p>
              {filteredBlockable.slice(0, 20).map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={u.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {u.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.userType?.replace("_", " ")}</p>
                  </div>
                  <button
                    onClick={() => blockUserMutation.mutate({ blockedId: u.id })}
                    className="text-xs text-destructive font-medium hover:text-destructive/80 transition"
                  >
                    Block
                  </button>
                </div>
              ))}
            </div>
          )}

          {blockedUsers.length === 0 && filteredBlockable.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <UserX size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No users to show</p>
              <p className="text-xs mt-1">Users you interact with will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Unblock confirmation */}
      <AlertDialog open={!!unblockTarget} onOpenChange={(o) => !o && setUnblockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock {unblockTarget?.name ?? "this user"}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be able to see your profile and message you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unblockTarget && unblockUserMutation.mutate({ blockedId: unblockTarget.id })}
            >
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
